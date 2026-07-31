import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { conferirSenha, decifrar } from "@/lib/cripto";
import { conferirTotp } from "@/lib/totp";
import { registrar } from "@/lib/auditoria";

/** Tempo de bloqueio apos tentativas malsucedidas seguidas. */
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

/**
 * Autenticacao com senha + TOTP na MESMA chamada.
 *
 * Deliberadamente em uma etapa so: um fluxo de duas etapas exigiria emitir uma
 * sessao "meio autenticada" entre a senha e o codigo, que e um estado a mais
 * para proteger e um alvo a mais para contornar o 2FA. Aqui, ou os tres fatores
 * conferem e nasce uma sessao completa, ou nao nasce sessao alguma.
 *
 * Todas as recusas devolvem a MESMA mensagem, para nao revelar se o e-mail
 * existe, se a senha estava certa ou se so o codigo falhou.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
        codigo: { label: "Codigo do aplicativo", type: "text" },
      },
      async authorize(credenciais) {
        const email = String(credenciais?.email ?? "").trim().toLowerCase();
        const senha = String(credenciais?.senha ?? "");
        const codigo = String(credenciais?.codigo ?? "");
        if (!email || !senha || !codigo) return null;

        const usuario = await prisma.usuario.findUnique({ where: { email } });

        // Registra a falha sem revelar a causa a quem tentou.
        const recusar = async (motivo: string) => {
          await registrar({
            usuarioId: usuario?.id ?? null,
            usuarioEmail: email,
            acao: "LOGIN_FALHO",
            entidade: "usuario",
            entidadeId: usuario?.id ?? null,
            descricao: `Tentativa de acesso recusada: ${motivo}`,
            sucesso: false,
          }).catch(() => undefined);
          return null;
        };

        if (!usuario) return recusar("credenciais invalidas");
        if (!usuario.ativo) return recusar("usuario inativo");
        if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
          return recusar("conta temporariamente bloqueada");
        }

        const anotarFalha = async () => {
          const tentativas = usuario.tentativasFalhas + 1;
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
              tentativasFalhas: tentativas,
              bloqueadoAte:
                tentativas >= MAX_TENTATIVAS
                  ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60_000)
                  : null,
            },
          });
        };

        if (!conferirSenha(senha, usuario.senhaHash)) {
          await anotarFalha();
          return recusar("credenciais invalidas");
        }

        // 2FA e OBRIGATORIO para todos os perfis: sem TOTP configurado, nao
        // ha login — nem mesmo com a senha correta.
        if (!usuario.totpSegredoCifrado || !usuario.totpVersaoChave) {
          return recusar("2FA nao configurado");
        }

        const segredo = decifrar(
          Buffer.from(usuario.totpSegredoCifrado),
          `totp:${usuario.id}`,
          usuario.totpVersaoChave,
        );

        const resultado = conferirTotp(codigo, segredo, {
          contadorMinimo: usuario.totpUltimoContador,
        });
        if (!resultado.valido) {
          await anotarFalha();
          return recusar("codigo de verificacao invalido");
        }

        // Grava o contador usado: o mesmo codigo nao vale duas vezes.
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            totpUltimoContador: resultado.contador!,
            tentativasFalhas: 0,
            bloqueadoAte: null,
            ultimoLoginEm: new Date(),
          },
        });

        await registrar({
          usuarioId: usuario.id,
          usuarioEmail: usuario.email,
          acao: "LOGIN",
          entidade: "usuario",
          entidadeId: usuario.id,
          descricao: "Acesso autenticado com senha e segundo fator",
        });

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
          unidade: usuario.unidade,
        };
      },
    }),
  ],
});
