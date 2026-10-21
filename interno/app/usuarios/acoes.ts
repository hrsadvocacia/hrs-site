"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { cifrar, gerarHashSenha, gerarTokenAleatorio } from "@/lib/cripto";
import { gerarSegredoTotp, uriTotp } from "@/lib/totp";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
  credencial?: { email: string; senhaTemporaria: string; uriTotp: string };
  valores?: Record<string, string>;
}

const PERFIS = ["SOCIO", "ADVOGADO", "ESTAGIARIO", "FINANCEIRO", "ADMIN"];
const UNIDADES = ["GOIANIA", "TERESINA", "TIMON"];

/**
 * Criação de conta pelo ADMIN.
 *
 * A senha temporária e o segredo TOTP são exibidos UMA ÚNICA VEZ, na resposta
 * desta ação — não ficam guardados em claro nem são enviados por e-mail. A
 * conta nasce com `exigeTrocaSenha`, de modo que a senha que o administrador
 * conheceu deixa de valer no primeiro acesso do titular.
 *
 * 2FA é obrigatório para todos os perfis: o segredo já nasce cadastrado e o
 * login exige o código desde a primeira entrada.
 */
export async function criarUsuario(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const admin = await exigirPermissao("usuario", "criar");
  const valores = {
    nome: String(dados.get("nome") ?? "").trim(),
    email: String(dados.get("email") ?? "").trim().toLowerCase(),
    perfil: String(dados.get("perfil") ?? ""),
    unidade: String(dados.get("unidade") ?? ""),
    oabNumero: String(dados.get("oabNumero") ?? "").trim(),
    oabUf: String(dados.get("oabUf") ?? "").trim().toUpperCase(),
  };

  if (valores.nome.length < 3) return { erro: "Informe o nome completo.", valores };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email)) return { erro: "E-mail inválido.", valores };
  if (!PERFIS.includes(valores.perfil)) return { erro: "Perfil inválido.", valores };
  if (!UNIDADES.includes(valores.unidade)) return { erro: "Unidade inválida.", valores };

  const jaExiste = await prisma.usuario.findUnique({ where: { email: valores.email }, select: { id: true } });
  if (jaExiste) return { erro: "Já existe conta com este e-mail.", valores };

  const senhaTemporaria = gerarTokenAleatorio(12);
  const segredoTotp = gerarSegredoTotp();

  const usuario = await prisma.$transaction(async (tx) => {
    const criado = await tx.usuario.create({
      data: {
        nome: valores.nome,
        email: valores.email,
        perfil: valores.perfil as never,
        unidade: valores.unidade as never,
        senhaHash: gerarHashSenha(senhaTemporaria),
        exigeTrocaSenha: true,
      },
      select: { id: true },
    });
    const { blob, versaoChave } = cifrar(segredoTotp, `totp:${criado.id}`);
    await tx.usuario.update({
      where: { id: criado.id },
      data: { totpSegredoCifrado: new Uint8Array(blob), totpVersaoChave: versaoChave, totpAtivadoEm: new Date() },
    });
    if (valores.oabNumero && valores.oabUf.length === 2) {
      await tx.inscricaoOab.create({
        data: { usuarioId: criado.id, numero: valores.oabNumero, uf: valores.oabUf, principal: true },
      });
    }
    return criado;
  });

  await registrar({
    usuarioId: admin.id,
    usuarioEmail: admin.email,
    acao: "ALTERACAO_PERMISSAO",
    entidade: "usuario",
    entidadeId: usuario.id,
    descricao: `Conta criada com perfil ${valores.perfil} na unidade ${valores.unidade}`,
  });

  revalidatePath("/usuarios");
  return {
    ok: "Conta criada. Anote as credenciais agora: elas não serão exibidas de novo.",
    credencial: { email: valores.email, senhaTemporaria, uriTotp: uriTotp(segredoTotp, valores.email) },
  };
}

export async function alterarPerfil(usuarioId: string, perfil: string, unidade: string): Promise<void> {
  const admin = await exigirPermissao("usuario", "editar");
  if (!PERFIS.includes(perfil) || !UNIDADES.includes(unidade)) throw new Error("Perfil ou unidade inválidos.");
  const antes = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { perfil: true, unidade: true } });
  await prisma.usuario.update({ where: { id: usuarioId }, data: { perfil: perfil as never, unidade: unidade as never } });
  await registrar({
    usuarioId: admin.id,
    usuarioEmail: admin.email,
    acao: "ALTERACAO_PERMISSAO",
    entidade: "usuario",
    entidadeId: usuarioId,
    descricao: `Perfil alterado de ${antes.perfil}/${antes.unidade} para ${perfil}/${unidade}`,
    camposAlterados: ["perfil", "unidade"],
  });
  revalidatePath("/usuarios");
}

/**
 * Desligamento. `ativo = false` corta o acesso na requisição seguinte, porque
 * `lib/sessao.ts` reconfere o cadastro a cada página e server action — não
 * espera o JWT expirar. As sessões abertas também são revogadas.
 */
export async function inativarUsuario(usuarioId: string): Promise<void> {
  const admin = await exigirPermissao("usuario", "inativar");
  if (admin.id === usuarioId) throw new Error("Não é possível inativar a própria conta.");
  await prisma.$transaction([
    prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: false } }),
    prisma.sessao.updateMany({ where: { usuarioId, revogadaEm: null }, data: { revogadaEm: new Date() } }),
  ]);
  await registrar({
    usuarioId: admin.id,
    usuarioEmail: admin.email,
    acao: "INATIVACAO",
    entidade: "usuario",
    entidadeId: usuarioId,
    descricao: "Conta inativada e sessões revogadas",
  });
  revalidatePath("/usuarios");
}

export async function reativarUsuario(usuarioId: string): Promise<void> {
  const admin = await exigirPermissao("usuario", "editar");
  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: true, tentativasFalhas: 0, bloqueadoAte: null } });
  await registrar({
    usuarioId: admin.id,
    usuarioEmail: admin.email,
    acao: "ALTERACAO_PERMISSAO",
    entidade: "usuario",
    entidadeId: usuarioId,
    descricao: "Conta reativada",
  });
  revalidatePath("/usuarios");
}

/** Redefinição de senha e de 2FA — para quando alguém perde o aparelho. */
export async function redefinirCredenciais(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const admin = await exigirPermissao("usuario", "editar");
  const usuarioId = String(dados.get("usuarioId") ?? "");
  const redefinirTotp = dados.get("redefinirTotp") === "on";

  const alvo = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { email: true } });
  if (!alvo) return { erro: "Conta não encontrada." };

  const senhaTemporaria = gerarTokenAleatorio(12);
  const segredoTotp = redefinirTotp ? gerarSegredoTotp() : null;

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        senhaHash: gerarHashSenha(senhaTemporaria),
        senhaAtualizadaEm: new Date(),
        exigeTrocaSenha: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        ...(segredoTotp
          ? (() => {
              const { blob, versaoChave } = cifrar(segredoTotp, `totp:${usuarioId}`);
              return {
                totpSegredoCifrado: new Uint8Array(blob),
                totpVersaoChave: versaoChave,
                totpAtivadoEm: new Date(),
                totpUltimoContador: null,
              };
            })()
          : {}),
      },
    });
    await tx.sessao.updateMany({ where: { usuarioId, revogadaEm: null }, data: { revogadaEm: new Date() } });
  });

  await registrar({
    usuarioId: admin.id,
    usuarioEmail: admin.email,
    acao: "ALTERACAO_PERMISSAO",
    entidade: "usuario",
    entidadeId: usuarioId,
    descricao: `Credenciais redefinidas${redefinirTotp ? " (inclusive o segundo fator)" : ""}`,
  });

  revalidatePath("/usuarios");
  return {
    ok: "Credenciais redefinidas. Entregue-as pessoalmente ao titular.",
    credencial: {
      email: alvo.email,
      senhaTemporaria,
      uriTotp: segredoTotp ? uriTotp(segredoTotp, alvo.email) : "",
    },
  };
}
