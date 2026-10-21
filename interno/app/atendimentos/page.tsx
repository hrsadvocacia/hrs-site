import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { dataBR, dataHoraBR, hojeISO, iso } from "@/lib/tempo";
import { CANAL_ATENDIMENTO, rotulo } from "@/lib/rotulos";

export const metadata = { title: "Atendimentos — HRS Interno" };

export default async function Atendimentos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await exigirPermissao("atendimento", "ler");
  const { q } = await searchParams;
  const busca = (q ?? "").trim();
  const hoje = hojeISO();

  const atendimentos = await prisma.atendimento.findMany({
    where: busca ? { cliente: { nome: { contains: busca, mode: "insensitive" } } } : undefined,
    orderBy: { data: "desc" },
    take: 100,
    include: {
      cliente: { select: { id: true, nome: true } },
      processo: { select: { id: true, numeroCnj: true } },
      atendidoPor: { select: { nome: true } },
    },
  });

  // Providência combinada com o cliente e vencida: o compromisso é do
  // escritório, não do cliente — aparece em destaque.
  const pendentes = atendimentos.filter(
    (a) => a.proximoPasso && a.proximoPassoEm && iso(a.proximoPassoEm) <= hoje,
  );

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Atendimentos</h1>
        <p className="legenda">Histórico do relacionamento com o cliente: quem falou, quando e o que ficou combinado.</p>

        {pendentes.length > 0 && (
          <div className="aviso aviso-atencao">
            <strong>{pendentes.length} providência(s) combinada(s) com o cliente já venceu(ram).</strong>
            <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.2rem" }}>
              {pendentes.slice(0, 5).map((a) => (
                <li key={a.id}>{a.cliente.nome}: {a.proximoPasso} — até {dataBR(a.proximoPassoEm)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="acoes">
          {pode(usuario.perfil, "atendimento", "criar") && <Link className="botao" href="/atendimentos/novo">Registrar atendimento</Link>}
        </div>

        <form className="formulario" method="get">
          <label><span>Buscar por cliente</span><input name="q" defaultValue={busca} /></label>
          <div className="acoes"><button className="botao-secundario" type="submit">Buscar</button></div>
        </form>

        {atendimentos.length === 0 ? <p className="vazio">Nenhum atendimento registrado.</p> : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Quando</th><th>Cliente</th><th>Canal</th><th>Atendido por</th><th>Resumo</th><th>Próximo passo</th></tr></thead>
              <tbody>
                {atendimentos.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{dataHoraBR(a.data)}</td>
                    <td>
                      <Link href={`/clientes/${a.cliente.id}`}>{a.cliente.nome}</Link>
                      {a.processo && <><br /><small>{a.processo.numeroCnj}</small></>}
                    </td>
                    <td>{rotulo(CANAL_ATENDIMENTO, a.canal)}</td>
                    <td>{a.atendidoPor.nome}</td>
                    <td>{a.resumo}</td>
                    <td>
                      {a.proximoPasso
                        ? <>{a.proximoPasso}<br /><small>até {dataBR(a.proximoPassoEm)}</small></>
                        : "—"}
                    </td>
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
