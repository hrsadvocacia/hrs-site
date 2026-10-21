"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { analisarCnj } from "@/lib/documentos";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
}

/**
 * Vincula uma publicação órfã a um processo, por ato humano.
 *
 * A vinculação manual é o desfecho normal da fila de triagem — não é exceção.
 * Toda publicação que o casamento automático não resolveu chega aqui.
 */
export async function vincularAoProcesso(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("publicacao", "editar");
  const publicacaoId = String(dados.get("publicacaoId") ?? "");
  const processoId = String(dados.get("processoId") ?? "");
  if (!processoId) return { erro: "Selecione o processo." };

  await prisma.publicacao.update({
    where: { id: publicacaoId },
    data: {
      processoId,
      status: "VINCULADA",
      suspeitaHomonimo: false,
      triadaPorId: usuario.id,
      triadaEm: new Date(),
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "TRIAGEM_PUBLICACAO",
    entidade: "publicacao",
    entidadeId: publicacaoId,
    descricao: "Publicação vinculada a processo por triagem manual",
  });

  revalidatePath("/publicacoes");
  revalidatePath(`/publicacoes/${publicacaoId}`);
  return { ok: "Publicação vinculada." };
}

/**
 * Descarte de publicação — com motivo, e sem apagar nada.
 *
 * O banco bloqueia DELETE por trigger e exige justificativa de ao menos 10
 * caracteres. Publicação descartada continua consultável: se a decisão foi
 * errada, o registro está lá para provar quando e por quem foi tomada.
 */
export async function descartarPublicacao(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("publicacao", "editar");
  const publicacaoId = String(dados.get("publicacaoId") ?? "");
  const justificativa = String(dados.get("justificativa") ?? "").trim();

  if (justificativa.length < 10) {
    return { erro: "Descreva por que esta comunicação não interessa ao escritório." };
  }

  await prisma.publicacao.update({
    where: { id: publicacaoId },
    data: {
      status: "DESCARTADA",
      justificativaDescarte: justificativa,
      triadaPorId: usuario.id,
      triadaEm: new Date(),
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "TRIAGEM_PUBLICACAO",
    entidade: "publicacao",
    entidadeId: publicacaoId,
    descricao: "Publicação descartada na triagem, com justificativa registrada",
  });

  revalidatePath("/publicacoes");
  revalidatePath(`/publicacoes/${publicacaoId}`);
  return { ok: "Descarte registrado." };
}

/**
 * Confirma que a fonte realmente não trouxe publicações naquele dia.
 *
 * "Não houve publicação" é uma afirmação, não um silêncio — e o banco exige
 * confirmante para este status.
 */
export async function confirmarDiaSemPublicacoes(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("publicacao", "confirmar");
  const capturaId = String(dados.get("capturaId") ?? "");

  await prisma.capturaDiaria.update({
    where: { id: capturaId },
    data: {
      status: "CONCLUIDA_SEM_PUBLICACOES",
      confirmadaPorId: usuario.id,
      confirmadaEm: new Date(),
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CONFIRMACAO_PRAZO",
    entidade: "captura_diaria",
    entidadeId: capturaId,
    descricao: "Conferido que não houve publicação no dia",
  });

  revalidatePath("/publicacoes");
  return { ok: "Confirmado." };
}

const esquemaManual = z.object({
  numeroCnj: z.string().trim().optional().or(z.literal("")),
  dataDisponibilizacao: z.string().min(10, "Informe a data de disponibilização."),
  teor: z.string().trim().min(20, "Cole o teor da comunicação."),
  urlCertidao: z.string().trim().optional().or(z.literal("")),
});

/**
 * Lançamento manual de publicação.
 *
 * Existe por dois motivos: enquanto a captura automática não estiver ligada,
 * é por aqui que a publicação entra no fluxo; e depois disso continua servindo
 * para o que a captura não alcança — comunicação recebida por outro caminho,
 * conferência do DEJT, intimação pessoal.
 */
export async function lancarPublicacaoManual(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("publicacao", "editar");
  const analise = esquemaManual.safeParse(
    Object.fromEntries(
      ["numeroCnj", "dataDisponibilizacao", "teor", "urlCertidao"].map((c) => [
        c,
        String(dados.get(c) ?? "").trim(),
      ]),
    ),
  );
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os campos." };
  }
  const d = analise.data;

  const { hashConteudo } = await import("@/lib/publicacoes/dedup");
  const { triar } = await import("@/lib/publicacoes/triagem");

  if (d.numeroCnj && !analisarCnj(d.numeroCnj)) {
    return { erro: "Número CNJ inválido: o dígito verificador não confere." };
  }

  const [processos, inscricoes] = await Promise.all([
    prisma.processo.findMany({ select: { id: true, numeroCnjDigitos: true } }),
    prisma.inscricaoOab.findMany({
      where: { ativa: true },
      select: { numero: true, uf: true, usuario: { select: { nome: true } } },
    }),
  ]);

  const destino = triar(
    { numeroProcesso: d.numeroCnj || null, teor: d.teor },
    processos,
    inscricoes.map((i) => ({ numero: i.numero, uf: i.uf, nomeAdvogado: i.usuario.nome })),
  );

  try {
    const criada = await prisma.publicacao.create({
      data: {
        fonte: "MANUAL",
        hashConteudo: hashConteudo(d.teor),
        numeroProcessoDigitos: destino.numeroProcessoDigitos,
        dataDisponibilizacao: new Date(`${d.dataDisponibilizacao}T00:00:00Z`),
        teor: d.teor,
        payloadBruto: { origem: "lancamento-manual", lancadoPor: usuario.email },
        urlCertidao: d.urlCertidao || null,
        processoId: destino.destino === "VINCULADA" ? destino.processoId : null,
        status: destino.destino === "VINCULADA" ? "VINCULADA" : "ORFA",
      },
      select: { id: true },
    });

    await registrar({
      usuarioId: usuario.id,
      usuarioEmail: usuario.email,
      acao: "CRIACAO",
      entidade: "publicacao",
      entidadeId: criada.id,
      descricao: "Publicação lançada manualmente",
    });
  } catch {
    return { erro: "Esta comunicação já está registrada (mesmo teor, processo e data)." };
  }

  revalidatePath("/publicacoes");
  return { ok: "Publicação registrada." };
}
