"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { exigeDeslocamento, type Unidade } from "@/lib/agenda/regras";
import { deDataHoraLocal } from "@/lib/tempo";

export interface EstadoFormulario {
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

const esquema = z.object({
  tipo: z.enum(["AUDIENCIA", "PERICIA", "REUNIAO", "SUSTENTACAO_ORAL", "DILIGENCIA", "OUTRO"]),
  titulo: z.string().trim().min(3, "Descreva o compromisso."),
  processoId: z.string().uuid().optional().or(z.literal("")),
  dataHora: z.string().min(10, "Informe data e hora."),
  duracaoMinutos: z.coerce.number().int().min(15).max(600),
  municipio: z.string().trim().min(2, "Informe o município."),
  uf: z.string().trim().length(2, "UF com duas letras."),
  forum: z.string().trim().optional().or(z.literal("")),
  endereco: z.string().trim().optional().or(z.literal("")),
  virtual: z.string().optional(),
  linkVirtual: z.string().trim().optional().or(z.literal("")),
  responsavelId: z.string().uuid("Selecione o responsável."),
  observacoes: z.string().trim().optional().or(z.literal("")),
});

const CAMPOS = [
  "tipo", "titulo", "processoId", "dataHora", "duracaoMinutos", "municipio", "uf",
  "forum", "endereco", "virtual", "linkVirtual", "responsavelId", "observacoes",
] as const;

/**
 * Agendamento de compromisso.
 *
 * `exigeDeslocamento` é calculado aqui, e não digitado: quem cadastra não
 * precisa lembrar que audiência em Anápolis é viagem para quem está em
 * Goiânia. É esse campo que alimenta o alerta de logística com 15 dias.
 */
export async function criarCompromisso(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("agenda", "criar");
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
  const virtual = d.virtual === "on";
  if (virtual && !d.linkVirtual) {
    return { erro: "Compromisso virtual precisa do link da sala.", campos: { linkVirtual: "Informe o link." }, valores };
  }

  const responsavel = await prisma.usuario.findUniqueOrThrow({
    where: { id: d.responsavelId },
    select: { unidade: true },
  });
  const deslocamento = exigeDeslocamento(
    { municipio: d.municipio, uf: d.uf, virtual },
    responsavel.unidade as Unidade,
  );

  const compromisso = await prisma.compromisso.create({
    data: {
      tipo: d.tipo,
      titulo: d.titulo,
      processoId: d.processoId || null,
      dataHora: deDataHoraLocal(d.dataHora),
      duracaoMinutos: d.duracaoMinutos,
      municipio: d.municipio,
      uf: d.uf.toUpperCase(),
      forum: d.forum || null,
      endereco: d.endereco || null,
      virtual,
      linkVirtual: d.linkVirtual || null,
      responsavelId: d.responsavelId,
      unidadeResponsavel: responsavel.unidade,
      exigeDeslocamento: deslocamento,
      observacoes: d.observacoes || null,
    },
    select: { id: true },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "compromisso",
    entidadeId: compromisso.id,
    descricao: `Compromisso agendado (${d.tipo}${deslocamento ? ", com deslocamento" : ""})`,
  });

  revalidatePath("/agenda");
  redirect("/agenda");
}

export async function mudarStatusCompromisso(
  compromissoId: string,
  status: "REALIZADO" | "ADIADO" | "CANCELADO",
): Promise<void> {
  const usuario = await exigirPermissao("agenda", "editar");
  await prisma.compromisso.update({ where: { id: compromissoId }, data: { status } });
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "compromisso",
    entidadeId: compromissoId,
    descricao: `Compromisso marcado como ${status}`,
    camposAlterados: ["status"],
  });
  revalidatePath("/agenda");
}
