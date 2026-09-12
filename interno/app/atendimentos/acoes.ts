"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { dataUTC, deDataHoraLocal } from "@/lib/tempo";

export interface EstadoFormulario {
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

const esquema = z.object({
  clienteId: z.string().uuid("Selecione o cliente."),
  processoId: z.string().uuid().optional().or(z.literal("")),
  data: z.string().min(10, "Informe a data e a hora."),
  canal: z.enum(["PRESENCIAL", "TELEFONE", "WHATSAPP", "EMAIL", "VIDEOCHAMADA", "OUTRO"]),
  resumo: z.string().trim().min(10, "Descreva o que foi tratado."),
  proximoPasso: z.string().trim().optional().or(z.literal("")),
  proximoPassoEm: z.string().optional().or(z.literal("")),
});

const CAMPOS = ["clienteId", "processoId", "data", "canal", "resumo", "proximoPasso", "proximoPassoEm"] as const;

/**
 * Registro de atendimento.
 *
 * O resumo é o histórico do relacionamento: quem falou com o cliente, quando,
 * por qual canal e o que ficou combinado. Não substitui anotação privilegiada
 * de estratégia — esta vive em `anotacao_privilegiada`, com outro controle de
 * acesso; aqui fica o que o próprio cliente sabe que foi conversado.
 */
export async function registrarAtendimento(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("atendimento", "criar");
  const valores: Record<string, string> = Object.fromEntries(
    CAMPOS.map((c) => [c, String(dados.get(c) ?? "").trim()]),
  );
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

  if (d.proximoPasso && !d.proximoPassoEm) {
    return {
      erro: "Havendo próximo passo, informe a data — providência sem data é providência esquecida.",
      campos: { proximoPassoEm: "Informe a data." },
      valores,
    };
  }

  const atendimento = await prisma.atendimento.create({
    data: {
      clienteId: d.clienteId,
      processoId: d.processoId || null,
      data: deDataHoraLocal(d.data),
      canal: d.canal,
      atendidoPorId: usuario.id,
      resumo: d.resumo,
      proximoPasso: d.proximoPasso || null,
      proximoPassoEm: d.proximoPassoEm ? dataUTC(d.proximoPassoEm) : null,
    },
    select: { id: true },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "atendimento",
    entidadeId: atendimento.id,
    descricao: `Atendimento registrado (${d.canal})`,
  });

  revalidatePath("/atendimentos");
  revalidatePath(`/clientes/${d.clienteId}`);
  redirect("/atendimentos");
}
