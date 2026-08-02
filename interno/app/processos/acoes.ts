"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { analisarCnj } from "@/lib/documentos";

const esquemaProcesso = z.object({
  numeroCnj: z.string().trim().min(1, "Informe o numero do processo."),
  clienteId: z.string().uuid("Selecione o cliente."),
  tribunalId: z.string().uuid("Selecione o tribunal."),
  orgaoJulgadorId: z.string().optional().or(z.literal("")),
  grau: z.enum(["PRIMEIRO", "SEGUNDO", "SUPERIOR", "EXTRAORDINARIO"]),
  poloCliente: z.enum(["ATIVO", "PASSIVO", "TERCEIRO_INTERESSADO"]),
  classeProcessual: z.string().trim().optional().or(z.literal("")),
  assunto: z.string().trim().optional().or(z.literal("")),
  valorCausa: z.string().trim().optional().or(z.literal("")),
  situacao: z.enum([
    "EM_ANDAMENTO", "SUSPENSO", "ARQUIVADO", "BAIXADO",
    "EXTINTO", "TRANSITADO_JULGADO", "EM_EXECUCAO",
  ]),
  advogadoResponsavelId: z.string().uuid("Selecione o advogado responsavel."),
  unidade: z.enum(["GOIANIA", "TERESINA", "TIMON"]),
  segredoJustica: z.string().optional().or(z.literal("")),
  dataDistribuicao: z.string().optional().or(z.literal("")),
  parteContraria: z.string().trim().optional().or(z.literal("")),
  advogadoAdverso: z.string().trim().optional().or(z.literal("")),
});

export interface EstadoFormulario {
  erro?: string;
  campos?: Record<string, string>;
  /** O que o usuario havia digitado, devolvido para nao apagar a ficha. */
  valores?: Record<string, string>;
}

export async function criarProcesso(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("processo", "criar");

  const bruto = Object.fromEntries(
    [
      "numeroCnj", "clienteId", "tribunalId", "orgaoJulgadorId", "grau",
      "poloCliente", "classeProcessual", "assunto", "valorCausa", "situacao",
      "advogadoResponsavelId", "unidade", "segredoJustica", "dataDistribuicao",
      "parteContraria", "advogadoAdverso",
    ].map((c) => [c, String(dados.get(c) ?? "").trim()]),
  );

  const analise = esquemaProcesso.safeParse(bruto);
  if (!analise.success) {
    const campos: Record<string, string> = {};
    for (const p of analise.error.issues) {
      const chave = String(p.path[0] ?? "");
      if (chave && !campos[chave]) campos[chave] = p.message;
    }
    return { erro: "Confira os campos destacados.", campos, valores: bruto };
  }
  const d = analise.data;

  // O digito verificador do CNJ e conferido ANTES de gravar. Numero digitado
  // errado casa com nenhuma publicacao do DJEN depois — e o processo ficaria
  // silenciosamente sem captura de prazo.
  const cnj = analisarCnj(d.numeroCnj);
  if (!cnj) {
    return {
      erro: "Numero CNJ invalido.",
      campos: {
        numeroCnj:
          "O digito verificador nao confere. Confira a digitacao do numero.",
      },
      valores: bruto,
    };
  }

  const duplicado = await prisma.processo.findUnique({
    where: { numeroCnjDigitos: cnj.digitos },
    select: { id: true },
  });
  if (duplicado) {
    return {
      erro: "Este processo ja esta cadastrado.",
      campos: { numeroCnj: "Numero ja cadastrado." },
      valores: bruto,
    };
  }

  const processo = await prisma.processo.create({
    data: {
      numeroCnj: cnj.formatado,
      numeroCnjDigitos: cnj.digitos,
      cnjSequencial: cnj.sequencial,
      cnjDigito: cnj.digito,
      cnjAno: cnj.ano,
      cnjSegmento: cnj.segmento,
      cnjTribunal: cnj.tribunal,
      cnjOrigem: cnj.origem,
      tribunalId: d.tribunalId,
      orgaoJulgadorId: d.orgaoJulgadorId || null,
      grau: d.grau,
      poloCliente: d.poloCliente,
      classeProcessual: d.classeProcessual || null,
      assunto: d.assunto || null,
      valorCausa: d.valorCausa ? d.valorCausa.replace(/\./g, "").replace(",", ".") : null,
      situacao: d.situacao,
      advogadoResponsavelId: d.advogadoResponsavelId,
      unidade: d.unidade,
      segredoJustica: d.segredoJustica === "on",
      dataDistribuicao: d.dataDistribuicao ? new Date(d.dataDistribuicao) : null,
      partes: {
        create: [
          {
            tipo: "CLIENTE",
            polo: d.poloCliente,
            clienteId: d.clienteId,
            nome: (
              await prisma.cliente.findUniqueOrThrow({
                where: { id: d.clienteId },
                select: { nome: true },
              })
            ).nome,
          },
          ...(d.parteContraria
            ? [
                {
                  tipo: "PARTE_CONTRARIA" as const,
                  polo:
                    d.poloCliente === "ATIVO"
                      ? ("PASSIVO" as const)
                      : ("ATIVO" as const),
                  nome: d.parteContraria,
                  advogadoAdverso: d.advogadoAdverso || null,
                },
              ]
            : []),
        ],
      },
    },
    select: { id: true },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "processo",
    entidadeId: processo.id,
    descricao: `Processo cadastrado no grau ${d.grau.toLowerCase()}`,
  });

  revalidatePath("/processos");
  redirect(`/processos/${processo.id}`);
}
