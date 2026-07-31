import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// O proxy (antigo middleware) roda na borda e faz apenas a triagem barata:
// existe sessao valida? A checagem de usuario ainda ativo, sessao revogada e
// permissao por perfil acontece em lib/sessao.ts, no runtime Node, a cada
// pagina e server action — o JWT sozinho continuaria valido por ate 30 minutos
// depois de alguem ser desligado do escritorio.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/((?!api/auth|entrar|_next/static|_next/image|favicon.ico).*)"],
};
