import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { reguaCobranca, situacaoParcela } from "@/lib/honorarios/regras";
import { deDecimal, formatarBRL } from "@/lib/honorarios/dinheiro";
import { hojeISO, iso, dataBR } from "@/lib/tempo";
import { formatarBR } from "@/lib/prazos/dias";
import { MARCO_COBRANCA, MODALIDADE_HONORARIOS, STATUS_PARCELA, UNIDADE, rotulo } from "@/lib/rotulos";
import { filtroContratos } from "./consulta";

export const metadata = { title: "Honorários — HRS Interno" };

export default async function Honorarios({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; situacao?: string }>;
}) {
  const usuario = await exigirPermissao("financeiro", "ler");
  const { unidade, situacao } = await searchParams;
  const hoje = hojeISO();
  const filtro = filtroContratos(usuario);

  const [contratos, parcelasAbertas] = await Promise.all([
    prisma.contratoHonorarios.findMany({
      where: {
        ...filtro,
        ...(unidade ? { unidade: unidade as never } : {}),
        ...(situacao === "encerrados" ? { ativo: false } : { ativo: true }),
      },
      orderBy: { criadoEm: "desc" },
      take: 200,
      include: {
        cliente: { select: { id: true, nome: true } },
        parcelas: { select: { status: true, vencimento: true, valor: true } },
        _count: { select: { processos: true } },
      },
    }),
    prisma.parcela.findMany({
      where: { status: "A_VENCER", contrato: { ativo: true, ...filtro } },
      include: { contrato: { select: { id: true, cliente: { select: { nome: true } } } } },
    }),
  ]);

  const regua = reguaCobranca(
    parcelasAbertas.map((p) => ({ ...p, vencimento: iso(p.vencimento) })),
    hoje,
  );
  const emAtraso = regua.filter((i) => i.marco.startsWith("ATRASO"));
  const totalAtraso = emAtraso.reduce((s, i) => s + deDecimal(i.parcela.valor), 0);

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Honorários</h1>
        <p className="legenda">
          Contratos, parcelas e régua de cobrança. A régua <strong>lista</strong>; quem cobra é gente,
          por mensagem validada, um cliente por vez.
        </p>

        <div className="grade">
          <div className="indicador">
            <div className="rotulo">Contratos ativos</div>
            <div className="numero">{contratos.filter((c) => c.ativo).length}</div>
          </div>
          <div className="indicador" style={emAtraso.length ? { borderTopColor: "var(--alerta)" } : undefined}>
            <div className="rotulo">Parcelas em atraso</div>
            <div className="numero" style={emAtraso.length ? { color: "var(--alerta)" } : undefined}>{emAtraso.length}</div>
            {emAtraso.length > 0 && <div className="legenda" style={{ margin: 0, fontSize: ".8rem" }}>{formatarBRL(totalAtraso)}</div>}
          </div>
          <div className="indicador">
            <div className="rotulo">Vencendo em 5 dias</div>
            <div className="numero">{regua.filter((i) => i.marco === "LEMBRETE_D5" || i.marco === "VENCE_HOJE").length}</div>
          </div>
        </div>

        <div className="acoes">
          {pode(usuario.perfil, "financeiro", "criar") && <Link className="botao" href="/honorarios/novo">Novo contrato</Link>}
          <Link className="botao-secundario" href="/honorarios/relatorio">Relatório</Link>
        </div>

        <h2>Régua de cobrança</h2>
        {regua.length === 0 ? (
          <p className="vazio">Nenhuma parcela vencendo ou em atraso.</p>
        ) : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Situação</th><th>Cliente</th><th>Vencimento</th><th>Valor</th><th></th></tr></thead>
              <tbody>
                {regua.map((i) => (
                  <tr key={i.parcela.id}>
                    <td>
                      <span className={`etiqueta ${i.marco.startsWith("ATRASO") ? "etiqueta-alerta" : "etiqueta-pendente"}`}>
                        {MARCO_COBRANCA[i.marco]}
                      </span>
                    </td>
                    <td>{i.parcela.contrato.cliente.nome}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatarBR(i.parcela.vencimento)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatarBRL(deDecimal(i.parcela.valor))}</td>
                    <td><Link href={`/honorarios/${i.parcela.contrato.id}`}>abrir contrato</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Contratos</h2>
        <form className="formulario" method="get" style={{ marginBottom: "1rem" }}>
          <div className="linha">
            <label>
              <span>Unidade</span>
              <select name="unidade" defaultValue={unidade ?? ""}>
                <option value="">Todas</option>
                <option value="GOIANIA">Goiânia – GO</option>
                <option value="TERESINA">Teresina – PI</option>
                <option value="TIMON">Timon – MA</option>
              </select>
            </label>
            <label>
              <span>Situação</span>
              <select name="situacao" defaultValue={situacao ?? ""}>
                <option value="">Ativos</option>
                <option value="encerrados">Encerrados</option>
              </select>
            </label>
          </div>
          <div className="acoes"><button type="submit" className="botao-secundario">Filtrar</button></div>
        </form>

        {contratos.length === 0 ? (
          <p className="vazio">Nenhum contrato encontrado.</p>
        ) : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Cliente</th><th>Modalidade</th><th>Unidade</th><th>Processos</th><th>Parcelas</th><th>Situação</th></tr></thead>
              <tbody>
                {contratos.map((c) => {
                  const abertas = c.parcelas.filter((p) => situacaoParcela({ status: p.status, vencimento: iso(p.vencimento) }, hoje) === "A_VENCER").length;
                  const atrasadas = c.parcelas.filter((p) => situacaoParcela({ status: p.status, vencimento: iso(p.vencimento) }, hoje) === "EM_ATRASO").length;
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/honorarios/${c.id}`}>{c.cliente.nome}</Link></td>
                      <td>{rotulo(MODALIDADE_HONORARIOS, c.modalidade)}</td>
                      <td>{rotulo(UNIDADE, c.unidade)}</td>
                      <td>{c._count.processos}</td>
                      <td>
                        {c.parcelas.length === 0 ? "—" : `${c.parcelas.filter((p) => p.status === "PAGO").length}/${c.parcelas.length} pagas`}
                        {atrasadas > 0 && <> · <span className="etiqueta etiqueta-alerta">{atrasadas} {rotulo(STATUS_PARCELA, "EM_ATRASO").toLowerCase()}</span></>}
                        {abertas > 0 && atrasadas === 0 && <> · {abertas} a vencer</>}
                      </td>
                      <td>{c.ativo ? "Ativo" : "Encerrado"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
