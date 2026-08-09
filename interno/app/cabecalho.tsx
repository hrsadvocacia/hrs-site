import Link from "next/link";
import { signOut } from "@/auth";
import { pode, type Perfil } from "@/lib/rbac";
import { PERFIL, UNIDADE, rotulo } from "@/lib/rotulos";

/**
 * Cabecalho no formato do timbrado: a arte da marca centralizada, a regra
 * dourada que atravessa a folha, e so entao a navegacao. A arte e servida como
 * imagem recortada do proprio .docx — nunca recriada com fontes.
 */
export function Cabecalho({
  nome,
  perfil,
  unidade,
}: {
  nome: string;
  perfil: Perfil;
  unidade: string;
}) {
  return (
    <header className="timbrado">
      <div className="timbrado-marca">
        <Link href="/">
          <img
            src="/marca/hrs-logo.png"
            alt="HRS Advocacia &amp; Consultoria Jurídica"
            width={172}
            height={87}
          />
        </Link>
      </div>
      <hr className="regra-ouro" />
      <div className="barra">
        {/* A navegacao reflete a mesma matriz de permissoes usada no servidor:
            o menu nao oferece caminho que a server action vai recusar depois. */}
        <nav>
          <Link href="/">Painel</Link>
          {pode(perfil, "cliente", "ler") && <Link href="/clientes">Clientes</Link>}
          {pode(perfil, "prazo", "ler") && <Link href="/prazos">Prazos</Link>}
          {pode(perfil, "publicacao", "ler") && (
            <Link href="/publicacoes">Publicações</Link>
          )}
          {pode(perfil, "processo", "ler") && <Link href="/processos">Processos</Link>}
          {pode(perfil, "publicacao", "ler") && (
            <Link href="/domicilio">Domicílio</Link>
          )}
          {pode(perfil, "calendario", "editar") && (
            <Link href="/calendarios">Calendários</Link>
          )}
        </nav>
        <div className="identificacao">
          <strong>{nome}</strong>
          {rotulo(PERFIL, perfil)} &middot; {rotulo(UNIDADE, unidade)}
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/entrar" });
          }}
        >
          <button className="botao-secundario">Sair</button>
        </form>
      </div>
    </header>
  );
}
