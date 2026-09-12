import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { formatarBRL } from "@/lib/honorarios/dinheiro";
import type { Consolidado } from "@/lib/honorarios/regras";
import { hojeISO, dataBR } from "@/lib/tempo";
import { NATUREZA_HONORARIOS, UNIDADE, rotulo } from "@/lib/rotulos";
import { consultarRelatorio, lerFiltro } from "./consulta";
import { deDecimal } from "@/lib/honorarios/dinheiro";

export const metadata = { title: "Relatório de honorários — HRS Interno" };

function TabelaConsolidado({ c }: { c: Consolidado }) {
  return (
    <div className="rolagem">
      <table>
        <thead><tr><th>Natureza</th><th>Realizado (recebido)</th><th>A receber</th><th>Provisão de êxito</th><th>Lançamentos</th></tr></thead>
        <tbody>
          {(["CONTRATUAL", "SUCUMBENCIA", "CONTRATUAL_DESTACADO"] as const).map((n) => (
            <tr key={n}>
              <td>{rotulo(NATUREZA_HONORARIOS, n)}</td>
              <td>{formatarBRL(c[n].realizadoCentavos)}</td>
              <td>{formatarBRL(c[n].aReceberCentavos)}</td>
              <td style={{ color: "var(--tinta-suave)" }}>{formatarBRL(c[n].provisionadoCentavos)}</td>
              <td>{c[n].quantidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Relatorio({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await exigirPermissao("financeiro", "ler");
  const hoje = hojeISO();
  const filtro = lerFiltro(await searchParams, hoje);
  const [dados, advogados] = await Promise.all([
    consultarRelatorio(usuario, filtro),
    prisma.usuario.findMany({ where: { perfil: { in: ["SOCIO", "ADVOGADO"] }, ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  const query = new URLSearchParams({ de: filtro.de, ate: filtro.ate, ...(filtro.unidade ? { unidade: filtro.unidade } : {}), ...(filtro.advogadoId ? { advogadoId: filtro.advogadoId } : {}) }).toString();

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Relatório de honorários</h1>
        <p className="legenda">
          Por período, unidade e advogado. As naturezas não são somadas entre si; provisão de êxito nunca é receita.
        </p>

        <form className="formulario" method="get">
          <div className="linha">
            <label><span>De</span><input type="date" name="de" defaultValue={filtro.de} /></label>
            <label><span>Até</span><input type="date" name="ate" defaultValue={filtro.ate} /></label>
            <label>
              <span>Unidade</span>
              <select name="unidade" defaultValue={filtro.unidade ?? ""}>
                <option value="">Todas</option>
                <option value="GOIANIA">Goiânia – GO</option>
                <option value="TERESINA">Teresina – PI</option>
                <option value="TIMON">Timon – MA</option>
              </select>
            </label>
            <label>
              <span>Advogado responsável</span>
              <select name="advogadoId" defaultValue={filtro.advogadoId ?? ""}>
                <option value="">Todos</option>
                {advogados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          </div>
          <div className="acoes">
            <button type="submit" className="botao-secundario">Aplicar</button>
            {pode(usuario.perfil, "financeiro", "exportar") && (
              <Link className="botao" href={`/honorarios/relatorio/exportar?${query}`}>Exportar CSV (Excel)</Link>
            )}
          </div>
        </form>

        <h2>Consolidado do período</h2>
        <TabelaConsolidado c={dados.geral} />

        {dados.porUnidade.size > 1 && (
          <>
            <h2>Por unidade</h2>
            {[...dados.porUnidade.entries()].map(([u, c]) => (
              <div key={u}>
                <h3>{rotulo(UNIDADE, u)}</h3>
                <TabelaConsolidado c={c} />
              </div>
            ))}
          </>
        )}

        {dados.porAdvogado.size > 0 && (
          <>
            <h2>Por advogado responsável</h2>
            {[...dados.porAdvogado.entries()].map(([nome, c]) => (
              <div key={nome}>
                <h3>{nome}</h3>
                <TabelaConsolidado c={c} />
              </div>
            ))}
          </>
        )}

        <h2>Lançamentos ({dados.lancamentos.length})</h2>
        {dados.lancamentos.length === 0 ? <p className="vazio">Nenhum lançamento no período.</p> : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Data</th><th>Natureza</th><th>Cliente</th><th>Processo</th><th>Unidade</th><th>Valor</th><th>Situação</th></tr></thead>
              <tbody>
                {dados.lancamentos.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{dataBR(l.dataReconhecimento)}</td>
                    <td>{rotulo(NATUREZA_HONORARIOS, l.natureza)}</td>
                    <td>{l.contrato ? <Link href={`/honorarios/${l.contrato.id}`}>{l.contrato.cliente.nome}</Link> : "—"}</td>
                    <td>{l.processo?.numeroCnj ?? "—"}</td>
                    <td>{rotulo(UNIDADE, l.unidade)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatarBRL(deDecimal(l.valor))}</td>
                    <td>{l.provisao ? "provisão" : l.recebido ? `recebido ${dataBR(l.recebidoEm)}` : "a receber"}</td>
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
