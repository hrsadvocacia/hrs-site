"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
}

const esquemaDia = z.object({
  calendarioId: z.string().uuid(),
  data: z.string().min(10, "Informe a data."),
  tipo: z.enum([
    "FERIADO_FORENSE",
    "SUSPENSAO_EXPEDIENTE",
    "PONTO_FACULTATIVO",
    "RECESSO_FORENSE",
    "SUSPENSAO_PRAZOS",
  ]),
  descricao: z.string().trim().min(3, "Descreva a ocorrência."),
  // Sem fonte não entra: dado de calendário sem origem registrada não é
  // defensável perante o cliente nem perante o juízo.
  fonte: z.string().trim().min(5, "Registre a portaria ou a lei de origem."),
  urlFonte: z.string().trim().optional().or(z.literal("")),
  suspendeExpediente: z.string().optional().or(z.literal("")),
  orgaoJulgadorId: z.string().optional().or(z.literal("")),
});

export async function adicionarDia(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("calendario", "editar");

  const analise = esquemaDia.safeParse(
    Object.fromEntries(
      ["calendarioId", "data", "tipo", "descricao", "fonte", "urlFonte",
       "suspendeExpediente", "orgaoJulgadorId"].map((c) => [c, String(dados.get(c) ?? "").trim()]),
    ),
  );
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os campos." };
  }
  const d = analise.data;

  const calendario = await prisma.calendarioTribunal.findUniqueOrThrow({
    where: { id: d.calendarioId },
    select: { status: true, ano: true },
  });
  // Calendário vigente não se edita: cria-se nova versão. Alterar um calendário
  // já usado mudaria a base de prazos calculados sem deixar rastro.
  if (calendario.status !== "RASCUNHO") {
    return {
      erro: "Calendário vigente não se edita. Crie uma nova versão para alterar.",
    };
  }

  await prisma.diaNaoUtilTribunal.create({
    data: {
      calendarioId: d.calendarioId,
      data: new Date(`${d.data}T00:00:00Z`),
      tipo: d.tipo,
      descricao: d.descricao,
      suspendeExpediente: d.suspendeExpediente === "on",
      fonte: d.fonte,
      urlFonte: d.urlFonte || null,
      orgaoJulgadorId: d.orgaoJulgadorId || null,
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "dia_nao_util_tribunal",
    entidadeId: d.calendarioId,
    descricao: `Dia sem expediente lançado no calendário de ${calendario.ano}`,
  });

  revalidatePath(`/calendarios/${d.calendarioId}`);
  return { ok: "Lançamento registrado." };
}

/**
 * Aprovação do calendário. É ela que libera o cálculo de prazos do tribunal —
 * enquanto o calendário estiver em RASCUNHO, o serviço recusa calcular.
 */
export async function aprovarCalendario(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("calendario", "editar");
  const id = String(dados.get("calendarioId") ?? "");

  const calendario = await prisma.calendarioTribunal.findUniqueOrThrow({
    where: { id },
    select: {
      status: true, ano: true, tribunalId: true, versao: true,
      _count: { select: { dias: true } },
      tribunal: { select: { sigla: true } },
    },
  });
  if (calendario.status !== "RASCUNHO") {
    return { erro: "Este calendário já foi aprovado." };
  }

  await prisma.$transaction([
    // A versão anterior sai de cena, mas continua no banco: prazos já
    // calculados apontam para ela e precisam continuar reconstituíveis.
    prisma.calendarioTribunal.updateMany({
      where: {
        tribunalId: calendario.tribunalId,
        ano: calendario.ano,
        status: "VIGENTE",
      },
      data: { status: "SUBSTITUIDO" },
    }),
    prisma.calendarioTribunal.update({
      where: { id },
      data: {
        status: "VIGENTE",
        vigenteDesde: new Date(),
        revisadoPorId: usuario.id,
        revisadoEm: new Date(),
      },
    }),
    prisma.revisaoAnualCalendario.updateMany({
      where: { tribunalId: calendario.tribunalId, ano: calendario.ano },
      data: { status: "CONCLUIDA", concluidoPorId: usuario.id, concluidoEm: new Date() },
    }),
  ]);

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "calendario_tribunal",
    entidadeId: id,
    descricao:
      `Calendário ${calendario.tribunal.sigla} ${calendario.ano} v${calendario.versao} ` +
      `aprovado com ${calendario._count.dias} lançamento(s)`,
  });

  revalidatePath(`/calendarios/${id}`);
  revalidatePath("/calendarios");
  return { ok: "Calendário aprovado e vigente." };
}
