import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";

export const metadata = { title: "Entrar — HRS Interno" };

/**
 * Senha e codigo do aplicativo na mesma tela, de proposito: um fluxo em duas
 * etapas exigiria uma sessao "meio autenticada" entre elas, que e um estado a
 * mais para proteger e um alvo a mais para contornar o 2FA.
 */
export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; motivo?: string }>;
}) {
  if ((await auth())?.user) redirect("/");
  const { erro, motivo } = await searchParams;

  async function entrar(dados: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: dados.get("email"),
        senha: dados.get("senha"),
        codigo: dados.get("codigo"),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/entrar?erro=1");
      throw e;
    }
  }

  return (
    <div className="entrada">
      <div className="folha">
        <div className="marca">
          <img
            src="/marca/hrs-logo.png"
            alt="HRS Advocacia &amp; Consultoria Jurídica"
            width={190}
            height={97}
          />
        </div>
        <hr className="regra-ouro" />
        <form action={entrar}>
          <h1>Sistema interno</h1>

        {erro && (
          // Mensagem unica de proposito: nao revela se o e-mail existe, se a
          // senha estava certa ou se so o codigo falhou.
          <p className="aviso aviso-erro">
            Não foi possível entrar. Confira e-mail, senha e o código do
            aplicativo autenticador.
          </p>
        )}
        {motivo === "sessao-invalida" && (
          <p className="aviso aviso-atencao">
            Sua sessão foi encerrada. Entre novamente.
          </p>
        )}

        <label>
          <span>E-mail</span>
          <input type="email" name="email" required autoComplete="username" />
        </label>

        <label>
          <span>Senha</span>
          <input
            type="password"
            name="senha"
            required
            autoComplete="current-password"
          />
        </label>

        <label>
          <span>Código do aplicativo</span>
          <input
            type="text"
            name="codigo"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="000000"
          />
          <small>
            Seis dígitos do aplicativo autenticador. O segundo fator e
            obrigatório para todos os perfis.
          </small>
        </label>

          <div className="acoes">
            <button type="submit" style={{ width: "100%", textAlign: "center" }}>
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
