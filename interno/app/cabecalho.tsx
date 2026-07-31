import Link from "next/link";
import { signOut } from "@/auth";
import { pode, type Perfil } from "@/lib/rbac";

const ROTULO_UNIDADE = {
  GOIANIA: "Goiania/GO",
  TERESINA: "Teresina/PI",
  TIMON: "Timon/MA",
} as const;

export function Cabecalho({
  nome,
  perfil,
  unidade,
}: {
  nome: string;
  perfil: Perfil;
  unidade: keyof typeof ROTULO_UNIDADE;
}) {
  // A navegacao reflete a mesma matriz de permissoes usada no servidor: o menu
  // nao oferece caminho que a server action vai recusar depois.
  return (
    <header className="topo">
      <span className="marca">HRS</span>
      <nav>
        <Link href="/">Painel</Link>
        {pode(perfil, "cliente", "ler") && <Link href="/clientes">Clientes</Link>}
        {pode(perfil, "processo", "ler") && <Link href="/processos">Processos</Link>}
      </nav>
      <div className="usuario">
        <div>
          {nome} — {perfil}
        </div>
        <div>{ROTULO_UNIDADE[unidade]}</div>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/entrar" });
        }}
      >
        <button className="botao-secundario" style={{ color: "#dbe6f5", borderColor: "#4a6c96" }}>
          Sair
        </button>
      </form>
    </header>
  );
}
