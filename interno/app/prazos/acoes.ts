"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirUsuario } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { podeConfirmarPrazo } from "@/lib/rbac";
import {
  calcularParaProcesso,
  CalendarioIndisponivelError,
  socioDaUnidade,
} from "@/lib/prazos/servico";
import { VERSAO_MOTOR } from "@/lib/prazos/motor";

export interface EstadoFormulario {
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

const esquema = z.object({
  processoId: z.string().uuid("Selecione o processo."),
  titulo: z.string().trim().min(3, "Descreva o ato a ser praticado."),
  descricaoAto: z.string().trim().optional().or(z.literal("")),
  prazoDias: z.coerce.number().int().min(1, "O prazo deve ter ao menos 1 dia."),
  regime: z.enum([
    "DIAS_UTEIS_TRABALHISTA",
    "DIAS_UTEIS_CPC",
    "DIAS_CORRIDOS_PENAL",
    "DIAS_CORRIDOS",
  ]),
  dataDisponibilizacao: z.string().optional().or(z.literal("")),
  dataPublicacao: z.string().optional().or(z.literal("")),
  responsavelId: z.string().uuid("Selecione o advogado responsável."),
});

const CAMPOS = [
  "processoId", "titulo", "descricaoAto", "prazoDias", "regime",
  "dataDisponibilizacao", "dataPublicacao", "responsavelId",
] as const;

function bruto(dados: FormData): Record<string, string> {
  return Object.fromEntries(
    CAMPOS.map((c) => [c, String(dados.get(c) ?? "").trim()]),
  );
}

/**
 * Cadastro manual de prazo.
 *
 * Nasce CONFIRMADO porque foi um advogado que o lançou, olhando os autos — e a
 * confirmação fica carimbada com o nome dele. Prazo de captura automática é
 * outra história: nasce PENDENTE_CONFERENCIA e o banco recusa qualquer outro
 * estado enquanto não houver confirmante (Fase 2).
 */
export async function criarPrazo(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("prazo", "criar");
  const valores = bruto(dados);
  const analise = esquema.safeParse(valores);

  if (!analise.success) {
    const campos: Record<string, string> = {};
    for (const p of analise.error.issues) {
      const chave = String(p.path[0] ?? "");
      if (chave && !campos[chave]) campos[chave] = p.message;
    }
    return { erro: "Confira os campos destacados.", campos, valores };
  }
  const d = analise.data;

  if (!d.dataDisponibilizacao && !d.dataPublicacao) {
    return {
      erro: "Informe a data de disponibilização no diário ou a data da ciência.",
      campos: { dataDisponibilizacao: "Informe ao menos uma das duas datas." },
      valores,
    };
  }

  let calculo;
  try {
    calculo = await calcularParaProcesso({
      processoId: d.processoId,
      prazoDias: d.prazoDias,
      regime: d.regime,
      dataDisponibilizacao: d.dataDisponibilizacao || undefined,
      dataPublicacao: d.dataPublicacao || undefined,
    });
  } catch (e) {
    if (e instanceof CalendarioIndisponivelError) {
      return { erro: e.message, valores };
    }
    // Data malformada, prazo inválido: a mensagem do motor já é clara e não
    // contém dado de cliente.
    return { erro: e instanceof Error ? e.message : "Não foi possível calcular o prazo.", valores };
  }

  const processo = await prisma.processo.findUniqueOrThrow({
    where: { id: d.processoId },
    select: { tribunalId: true },
  });

  const podeConfirmar = podeConfirmarPrazo(usuario.perfil);
  const agora = new Date();

  const prazo = await prisma.prazo.create({
    data: {
      processoId: d.processoId,
      titulo: d.titulo,
      descricaoAto: d.descricaoAto || null,
      origem: "MANUAL",
      status: podeConfirmar ? "CONFIRMADO" : "PENDENTE_CONFERENCIA",
      confirmadoPorId: podeConfirmar ? usuario.id : null,
      confirmadoEm: podeConfirmar ? agora : null,
      dataDisponibilizacao: d.dataDisponibilizacao
        ? new Date(`${d.dataDisponibilizacao}T00:00:00Z`)
        : null,
      dataPublicacaoConsiderada: new Date(`${calculo.dataPublicacaoConsiderada}T00:00:00Z`),
      dataInicioContagem: new Date(`${calculo.dataInicioContagem}T00:00:00Z`),
      prazoDias: d.prazoDias,
      regimeContagem: d.regime,
      tribunalId: processo.tribunalId,
      dataFatal: new Date(`${calculo.dataFatal}T00:00:00Z`),
      diasUteisContados: calculo.diasUteisContados,
      // Prisma exige o formato JSON estrutural; o serializa/desserializa
      // mantem o conteudo identico ao devolvido pelo motor.
      feriadosAplicados: JSON.parse(JSON.stringify(calculo.feriadosAplicados)),
      fundamentoLegal: calculo.fundamentoLegal,
      premissas: JSON.parse(JSON.stringify(calculo.premissas)),
      versaoMotor: VERSAO_MOTOR,
      calendarioId: calculo.calendarioId,
      responsavelId: d.responsavelId,
    },
    select: { id: true },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "prazo",
    entidadeId: prazo.id,
    descricao: podeConfirmar
      ? "Prazo lançado manualmente e confirmado pelo advogado"
      : "Prazo lançado manualmente, aguardando conferência de advogado",
  });

  revalidatePath("/prazos");
  redirect(`/prazos/${prazo.id}`);
}

/**
 * Confirmação de prazo — ato privativo de advogado.
 *
 * É a regra central do produto: o sistema assiste, o advogado decide. A
 * checagem de perfil está em `podeConfirmarPrazo`, e o banco ainda exige
 * confirmante e carimbo para o status sair de PENDENTE_CONFERENCIA.
 */
export async function confirmarPrazo(prazoId: string): Promise<void> {
  const usuario = await exigirPermissao("prazo", "confirmar");

  const prazo = await prisma.prazo.findUniqueOrThrow({
    where: { id: prazoId },
    select: { status: true },
  });
  if (prazo.status !== "PENDENTE_CONFERENCIA") {
    throw new Error("Este prazo não está pendente de conferência.");
  }

  await prisma.prazo.update({
    where: { id: prazoId },
    data: {
      status: "CONFIRMADO",
      confirmadoPorId: usuario.id,
      confirmadoEm: new Date(),
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CONFIRMACAO_PRAZO",
    entidade: "prazo",
    entidadeId: prazoId,
    descricao: "Prazo conferido e confirmado por advogado",
  });

  revalidatePath(`/prazos/${prazoId}`);
  revalidatePath("/prazos");
}

/** Registro de tratativa — é ele que interrompe o escalonamento ao sócio. */
export async function registrarTratativa(
  prazoId: string,
  descricao: string,
): Promise<void> {
  const usuario = await exigirPermissao("prazo", "editar");
  const texto = descricao.trim();
  if (texto.length < 5) throw new Error("Descreva a tratativa.");

  await prisma.$transaction([
    prisma.tratativaPrazo.create({
      data: { prazoId, usuarioId: usuario.id, descricao: texto },
    }),
    prisma.prazo.update({
      where: { id: prazoId },
      data: {
        primeiraTratativaEm: new Date(),
        status: "EM_TRATATIVA",
      },
    }),
  ]);

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "prazo",
    entidadeId: prazoId,
    descricao: "Tratativa registrada no prazo",
  });

  revalidatePath(`/prazos/${prazoId}`);
  revalidatePath("/prazos");
}

/** Baixa do prazo. O sistema nunca faz isso sozinho. */
export async function cumprirPrazo(prazoId: string): Promise<void> {
  const usuario = await exigirPermissao("prazo", "editar");
  await prisma.prazo.update({
    where: { id: prazoId },
    data: { status: "CUMPRIDO", cumpridoPorId: usuario.id, cumpridoEm: new Date() },
  });
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "prazo",
    entidadeId: prazoId,
    descricao: "Prazo baixado como cumprido",
  });
  revalidatePath(`/prazos/${prazoId}`);
  revalidatePath("/prazos");
}

/**
 * Cancelamento com justificativa. Prazo não se apaga — o banco bloqueia DELETE
 * por trigger, e a CHECK exige motivo com ao menos 10 caracteres.
 */
export async function cancelarPrazo(
  prazoId: string,
  justificativa: string,
): Promise<void> {
  const usuario = await exigirPermissao("prazo", "confirmar");
  const motivo = justificativa.trim();
  if (motivo.length < 10) {
    throw new Error("A justificativa do cancelamento precisa ser específica.");
  }

  await prisma.prazo.update({
    where: { id: prazoId },
    data: {
      status: "CANCELADO",
      canceladoPorId: usuario.id,
      canceladoEm: new Date(),
      justificativaCancelamento: motivo,
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CANCELAMENTO_PRAZO",
    entidade: "prazo",
    entidadeId: prazoId,
    descricao: "Prazo cancelado com justificativa registrada",
  });

  revalidatePath(`/prazos/${prazoId}`);
  revalidatePath("/prazos");
}

/** Sócio de referência para o escalonamento, usado pelo job de alertas. */
export async function socioDeEscalonamento(unidade: string) {
  await exigirUsuario();
  return socioDaUnidade(unidade);
}
