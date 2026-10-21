import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { GRAU, SITUACAO_PROCESSO, rotulo } from "@/lib/rotulos";

export const metadata = { title: "Processos — HRS Interno" };

export default async function Processos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; meus?: string }>;
}) {
  const usuario = await exigirPermissao("processo", "ler");
  const { q, meus } = await searchParams;
  const busca = (q ?? "").trim();

  const processos = await prisma.processo.findMany({
    where: {
      ...(meus === "1" ? { advogadoResponsavelId: usuario.id } : {}),
      ...(busca
        ? { numeroCnjDigitos: { contains: busca.replace(/\D/g, "") } }
        : {}),
    },
    orderBy: { criadoEm: "desc" },
    take: 100,
    select: {
      id: true,
      numeroCnj: true,
      situacao: true,
      grau: true,
      unidade: true,
      segredoJustica: true,
      tribunal: { select: { sigla: true } },
      advogadoResponsavel: { select: { nome: true } },
      partes: {
        where: { tipo: "CLIENTE" },
        take: 1,
        select: { nome: true },
      },
    },
  });

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Processos</h1>
        <p className="legenda">{processos.length} registro(s).</p>

        <form className="acoes" style={{ marginBottom: "1.25rem" }}>
          <input
            name="q"
            defaultValue={busca}
            placeholder="Buscar por número CNJ"
            style={{ maxWidth: 320 }}
          />
          <label style={{ display: "flex", gap: ".4rem", alignItems: "center", margin: 0 }}>
            <input type="checkbox" name="meus" value="1" defaultChecked={meus === "1"} style={{ width: "auto" }} />
            <span style={{ margin: 0 }}>Somente meus</span>
          </label>
          <button type="submit" className="botao-secundario">Filtrar</button>
          {pode(usuario.perfil, "processo", "criar") && (
            <Link className="botao" href="/processos/novo">Novo processo</Link>
          )}
        </form>

        {processos.length === 0 ? (
          <p className="vazio">Nenhum processo encontrado.</p>
        ) : (
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th>Número CNJ</th>
                  <th>Cliente</th>
                  <th>Tribunal</th>
                  <th>Grau</th>
                  <th>Situação</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {processos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/processos/${p.id}`}>{p.numeroCnj}</Link>
                      {p.segredoJustica && (
                        <> <span className="etiqueta etiqueta-alerta">segredo</span></>
                      )}
                    </td>
                    <td>{p.partes[0]?.nome ?? "—"}</td>
                    <td>{p.tribunal.sigla}</td>
                    <td>{rotulo(GRAU, p.grau)}</td>
                    <td>{rotulo(SITUACAO_PROCESSO, p.situacao)}</td>
                    <td>{p.advogadoResponsavel.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
