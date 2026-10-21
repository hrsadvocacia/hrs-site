import type { PerfilUsuario, Unidade } from "@/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    perfil: PerfilUsuario;
    unidade: Unidade;
  }

  interface Session {
    user: {
      id: string;
      perfil: PerfilUsuario;
      unidade: Unidade;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    usuarioId: string;
    perfil: PerfilUsuario;
    unidade: Unidade;
  }
}
