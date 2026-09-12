"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { importarLeads, RETENCAO_LEAD_DIAS } from "@/lib/leads/importacao";

export interface EstadoImportacao {
  erro?: string;
  ok?: string;
  resumo?: {
    total: number;
    prontos: number;
    semConsentimento: number;
    comErro: number;
    duplicados: number;
    problemas: Array<{ linha: number; erros: string[] }>;
  };
}

/**
 * Importação da planilha de leads dos simuladores.
 *
 * Prov. 205/2021: importar NÃO dispara nada. O lead entra na fila de contato
 * humano apenas se pediu contato COM data de consentimento — o resto entra
 * como SEM_CONSENTIMENTO e fica visível, para que o escritório saiba que
 * aquela pessoa existe e que não pode ser procurada.
 */
export async function importarPlanilha(
  _anterior: EstadoImportacao,
  dados: FormData,
): Promise<EstadoImportacao> {
  const usuario = await exigirPermissao("cliente", "criar");
  const arquivo = dados.get("planilha");
  const origemPadrao = String(dados.get("origem") ?? "").trim() || "planilha-importada";

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione o arquivo CSV exportado da planilha." };
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    return { erro: "Arquivo acima de 5 MB. Exporte apenas as colunas necessárias." };
  }

  const texto = Buffer.from(await arquivo.arrayBuffer()).toString("utf8");
  const leads = importarLeads(texto, origemPadrao);
  if (leads.length === 0) {
    return { erro: "A planilha não tem linhas de dados (ou o cabeçalho não foi reconhecido)." };
  }

  const agora = new Date();
  const descarte = new Date(agora.getTime() + RETENCAO_LEAD_DIAS * 86_400_000);
  let prontos = 0;
  let semConsentimento = 0;
  let duplicados = 0;
  const problemas: Array<{ linha: number; erros: string[] }> = [];

  for (const lead of leads) {
    if (lead.erros.length > 0) problemas.push({ linha: lead.linha, erros: lead.erros });
    if (!lead.nome || lead.whatsapp.length < 10) continue;

    // Deduplicação por WhatsApp + simulador: reimportar a mesma planilha não
    // multiplica a fila de contato.
    const existente = await prisma.lead.findFirst({
      where: { whatsapp: lead.whatsapp, simulador: lead.simulador },
      select: { id: true },
    });
    if (existente) {
      duplicados++;
      continue;
    }

    await prisma.lead.create({
      data: {
        simulador: lead.simulador,
        nome: lead.nome,
        whatsapp: lead.whatsapp,
        email: lead.email,
        payload: lead.payload,
        solicitouContato: lead.solicitouContato,
        consentimentoEm: lead.consentimentoEm,
        origemUtm: { origem: lead.origem },
        status: lead.solicitouContato ? "AGUARDANDO_CONTATO" : "SEM_CONSENTIMENTO",
        descartarApos: descarte,
      },
    });
    if (lead.solicitouContato) prontos++;
    else semConsentimento++;
  }

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "lead",
    descricao:
      `Importação de leads: ${leads.length} linha(s), ${prontos} com consentimento datado, ` +
      `${semConsentimento} sem consentimento, ${duplicados} já existentes`,
  });

  revalidatePath("/leads");
  return {
    ok: "Importação concluída. Nenhuma mensagem foi enviada.",
    resumo: { total: leads.length, prontos, semConsentimento, comErro: problemas.length, duplicados, problemas: problemas.slice(0, 20) },
  };
}

/** Atribuição e mudança de situação do lead — sempre ato de pessoa. */
export async function atualizarLead(
  leadId: string,
  campos: { status?: string; responsavelId?: string | null },
): Promise<void> {
  const usuario = await exigirPermissao("cliente", "editar");
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { solicitouContato: true, status: true },
  });

  // A trava que importa: um lead que não consentiu jamais passa a
  // "em contato". Se a pessoa ligou depois e pediu, o consentimento se
  // registra pelo cadastro de cliente, não por mudança de status aqui.
  if (!lead.solicitouContato && campos.status && campos.status !== "DESCARTADO") {
    throw new Error(
      "Este lead não registrou consentimento para contato. O Provimento 205/2021 veda a abordagem — só é possível descartá-lo.",
    );
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(campos.status ? { status: campos.status as never } : {}),
      ...(campos.responsavelId !== undefined ? { responsavelId: campos.responsavelId } : {}),
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "lead",
    entidadeId: leadId,
    descricao: `Lead atualizado${campos.status ? ` para ${campos.status}` : ""}`,
    camposAlterados: Object.keys(campos),
  });

  revalidatePath("/leads");
}
