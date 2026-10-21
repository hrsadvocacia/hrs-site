"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { expiracao, gerarTokenPortal, hashTokenPortal, VALIDADE_PADRAO_DIAS } from "@/lib/portal/acesso";

export interface EstadoAcesso {
  erro?: string;
  ok?: string;
  link?: string;
}

/**
 * Emissão de link do portal. O token aparece UMA vez, aqui — depois só existe
 * o hash. Se o cliente perder o link, emite-se outro; não há como recuperar.
 */
export async function emitirAcessoPortal(
  _anterior: EstadoAcesso,
  dados: FormData,
): Promise<EstadoAcesso> {
  const usuario = await exigirPermissao("cliente", "editar");
  const clienteId = String(dados.get("clienteId") ?? "");
  const dias = Number(dados.get("dias") ?? VALIDADE_PADRAO_DIAS) || VALIDADE_PADRAO_DIAS;
  if (!clienteId) return { erro: "Cliente não informado." };
  if (dias < 1 || dias > 180) return { erro: "A validade deve ficar entre 1 e 180 dias." };

  const token = gerarTokenPortal();
  await prisma.acessoPortal.create({
    data: {
      clienteId,
      tokenHash: hashTokenPortal(token),
      criadoPorId: usuario.id,
      expiraEm: expiracao(dias),
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "acesso_portal",
    entidadeId: clienteId,
    descricao: `Link do portal emitido com validade de ${dias} dias`,
  });

  revalidatePath(`/clientes/${clienteId}`);
  return {
    ok: "Link emitido. Copie agora: ele não será exibido de novo.",
    link: `/portal/${token}`,
  };
}

export async function revogarAcessoPortal(acessoId: string): Promise<void> {
  const usuario = await exigirPermissao("cliente", "editar");
  const acesso = await prisma.acessoPortal.update({
    where: { id: acessoId },
    data: { revogadoEm: new Date() },
    select: { clienteId: true },
  });
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "INATIVACAO",
    entidade: "acesso_portal",
    entidadeId: acessoId,
    descricao: "Link do portal revogado",
  });
  revalidatePath(`/clientes/${acesso.clienteId}`);
}
