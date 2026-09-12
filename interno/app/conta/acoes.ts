"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { conferirSenha, gerarHashSenha } from "@/lib/cripto";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
}

const MINIMO = 12;

/**
 * Troca de senha pelo próprio titular.
 *
 * Exige a senha atual: sessão sequestrada não deve conseguir trocar a senha e
 * expulsar o dono. O mínimo de 12 caracteres vem de uma escolha simples — em
 * vez de exigir símbolo e número (o que produz "Senha@123"), exige-se
 * comprimento, que é o que de fato encarece o ataque.
 */
export async function trocarSenha(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario();
  const atual = String(dados.get("senhaAtual") ?? "");
  const nova = String(dados.get("senhaNova") ?? "");
  const confirmacao = String(dados.get("senhaConfirmacao") ?? "");

  if (nova.length < MINIMO) return { erro: `A nova senha precisa de ao menos ${MINIMO} caracteres.` };
  if (nova !== confirmacao) return { erro: "A confirmação não confere." };
  if (nova === atual) return { erro: "A nova senha precisa ser diferente da atual." };

  const registro = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuario.id },
    select: { senhaHash: true },
  });
  if (!conferirSenha(atual, registro.senhaHash)) return { erro: "Senha atual incorreta." };

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: gerarHashSenha(nova), senhaAtualizadaEm: new Date(), exigeTrocaSenha: false },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "usuario",
    entidadeId: usuario.id,
    descricao: "Senha alterada pelo próprio titular",
    camposAlterados: ["senhaHash"],
  });

  revalidatePath("/conta");
  return { ok: "Senha alterada." };
}
