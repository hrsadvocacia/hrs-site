import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AcessoNegadoError, podeOuFalha, type Acao, type Perfil, type Recurso } from "@/lib/rbac";
import { registrar } from "@/lib/auditoria";

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  unidade: "GOIANIA" | "TERESINA" | "TIMON";
}

/**
 * Ponto unico de verificacao de sessao para paginas e server actions.
 *
 * O middleware so confere se existe um JWT valido — o que continua verdadeiro
 * por ate 30 minutos depois de um advogado ser desligado do escritorio. Aqui a
 * conta e reconferida no banco a cada requisicao: perfil revogado ou usuario
 * inativado perde acesso na hora, e nao no fim da sessao.
 */
export async function exigirUsuario(): Promise<UsuarioAutenticado> {
  const sessao = await auth();
  if (!sessao?.user?.id) redirect("/entrar");

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.user.id },
    select: { id: true, nome: true, email: true, perfil: true, unidade: true, ativo: true },
  });

  if (!usuario || !usuario.ativo) redirect("/entrar?motivo=sessao-invalida");

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil as Perfil,
    unidade: usuario.unidade,
  };
}

/**
 * Exige sessao E permissao. Use no inicio de toda server action que toque
 * dado de cliente — `podeOuFalha` lanca, entao esquecer de tratar o retorno
 * bloqueia em vez de vazar.
 *
 * A recusa NAO vira tela de erro 500. Erro generico faz o usuario achar que o
 * sistema quebrou e abrir chamado; pior, ensina a equipe a ignorar tela de
 * erro. Aqui a tentativa e registrada na auditoria (e uma informacao de
 * seguranca: alguem tentou abrir o que nao lhe cabe) e a pessoa e levada a uma
 * pagina que explica, no timbrado, o que aconteceu.
 */
export async function exigirPermissao(
  recurso: Recurso,
  acao: Acao,
): Promise<UsuarioAutenticado> {
  const usuario = await exigirUsuario();
  try {
    podeOuFalha(usuario.perfil, recurso, acao);
  } catch (erro) {
    if (erro instanceof AcessoNegadoError) {
      await registrar({
        usuarioId: usuario.id,
        usuarioEmail: usuario.email,
        acao: "LEITURA",
        entidade: recurso,
        descricao: `Acesso recusado pelo perfil: ${acao} em ${recurso}`,
        sucesso: false,
      }).catch(() => undefined);
      redirect(`/sem-permissao?recurso=${encodeURIComponent(recurso)}&acao=${encodeURIComponent(acao)}`);
    }
    throw erro;
  }
  return usuario;
}
