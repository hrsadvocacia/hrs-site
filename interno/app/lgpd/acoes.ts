"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { anonimizarCliente, anonimizarLead } from "@/lib/lgpd/retencao";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
}

/**
 * Anonimização de lead vencido.
 *
 * É o único caso em que a rotina age sem revisão caso a caso: lead que NUNCA
 * pediu contato e passou do prazo de retenção não tem relação jurídica que
 * justifique a guarda do nome e do telefone (LGPD art. 15, I e art. 16). Os
 * leads que viraram cliente ou estão em atendimento não são tocados.
 */
export async function anonimizarLeadsVencidos(): Promise<void> {
  const usuario = await exigirPermissao("cliente", "inativar");
  const hoje = new Date();

  const vencidos = await prisma.lead.findMany({
    where: {
      descartarApos: { lte: hoje },
      status: { in: ["SEM_CONSENTIMENTO", "DESCARTADO", "AGUARDANDO_CONTATO"] },
      clienteConvertidoId: null,
      NOT: { nome: { startsWith: "Lead anonimizado" } },
    },
    select: { id: true },
  });

  for (const lead of vencidos) {
    const { origemUtm: _descartado, payload, ...campos } = anonimizarLead(lead.id);
    await prisma.lead.update({
      where: { id: lead.id },
      // `DbNull` e nao `null`: em coluna JSON, `null` do Prisma significa
      // "nao mexa"; o valor SQL NULL se pede por Prisma.DbNull.
      data: { ...campos, payload, origemUtm: Prisma.DbNull },
    });
  }

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ANONIMIZACAO",
    entidade: "lead",
    descricao: `${vencidos.length} lead(s) vencido(s) anonimizado(s) por retenção (LGPD art. 15, I)`,
  });

  revalidatePath("/lgpd");
  revalidatePath("/leads");
}

/**
 * Anonimização de cliente a pedido do titular ou por fim de retenção.
 *
 * NÃO apaga processo, prazo, auditoria nem lançamento financeiro: são registros
 * de exercício regular de direito e de obrigação legal (LGPD art. 16, I e II).
 * O que se apaga é a IDENTIFICAÇÃO do titular no cadastro; dado sensível de
 * saúde é apagado de fato, porque a base legal dele era o processo.
 */
export async function anonimizarClientePorPedido(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("cliente", "inativar");
  const clienteId = String(dados.get("clienteId") ?? "");
  const justificativa = String(dados.get("justificativa") ?? "").trim();
  if (!clienteId) return { erro: "Selecione o cliente." };
  if (justificativa.length < 15) {
    return { erro: "Descreva o pedido do titular ou o fundamento da retenção vencida (mínimo 15 caracteres)." };
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nome: true,
      processos: { select: { processo: { select: { situacao: true } } } },
    },
  });
  if (!cliente) return { erro: "Cliente não encontrado." };

  const emCurso = cliente.processos.filter((p) =>
    ["EM_ANDAMENTO", "EM_EXECUCAO", "SUSPENSO"].includes(p.processo.situacao),
  ).length;
  if (emCurso > 0) {
    return {
      erro:
        `Este cliente tem ${emCurso} processo(s) em curso. A LGPD (art. 16, II e III) autoriza a guarda para ` +
        "o exercício regular de direitos em processo — anonimizar agora inviabilizaria a própria defesa. " +
        "O pedido do titular deve ser respondido explicando isso.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.cliente.update({ where: { id: clienteId }, data: anonimizarCliente(clienteId) });
    await tx.contatoCliente.deleteMany({ where: { clienteId } });
    await tx.enderecoCliente.deleteMany({ where: { clienteId } });
    await tx.dadoSensivelCliente.updateMany({
      where: { clienteId },
      data: { conteudoCifrado: new Uint8Array(0), rotulo: "Registro anonimizado", anonimizadoEm: new Date() },
    });
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ANONIMIZACAO",
    entidade: "cliente",
    entidadeId: clienteId,
    descricao: `Cadastro de cliente anonimizado. Fundamento registrado pelo responsável (${justificativa.length} caracteres)`,
  });

  revalidatePath("/lgpd");
  revalidatePath("/clientes");
  return { ok: "Cadastro anonimizado. Processos, prazos e lançamentos foram preservados como exige a lei." };
}
