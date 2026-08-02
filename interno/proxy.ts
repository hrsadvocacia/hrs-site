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
  matcher: [
    /*
     * Fora da triagem:
     *   api/auth  — o proprio fluxo de autenticacao;
     *   entrar    — a tela de login;
     *   _next     — artefatos de build;
     *   qualquer caminho com ponto — arquivo estatico servido de public/.
     *
     * O ultimo caso importa: sem ele a arte da marca fica atras da sessao e a
     * TELA DE LOGIN carrega sem o timbrado, que e exatamente onde ele precisa
     * aparecer. Nenhum arquivo de public/ contem dado de cliente — documento de
     * processo nao mora ali, e servido por URL assinada de curta duracao.
     */
    "/((?!api/auth|entrar|_next|.*\\.).*)",
  ],
};
