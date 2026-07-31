import type { NextAuthConfig } from "next-auth";

/**
 * Configuracao compartilhada com o middleware (Edge Runtime).
 *
 * Nao pode importar Prisma nem `node:crypto`: o middleware roda na borda, onde
 * esses modulos nao existem. A verificacao pesada — usuario ainda ativo, sessao
 * nao revogada — acontece em `lib/sessao.ts`, no runtime Node.
 */
export const authConfig = {
  pages: {
    signIn: "/entrar",
    error: "/entrar",
  },
  session: {
    strategy: "jwt",
    // Sessao curta: sistema sob sigilo profissional acessado de notebook em
    // audiencia e de balcao de forum nao pode ficar aberto o dia inteiro.
    maxAge: 30 * 60,
    updateAge: 5 * 60,
  },
  trustHost: true,
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.perfil = user.perfil;
        token.unidade = user.unidade;
        token.usuarioId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.usuarioId as string;
        session.user.perfil = token.perfil as typeof session.user.perfil;
        session.user.unidade = token.unidade as typeof session.user.unidade;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
