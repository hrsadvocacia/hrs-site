import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { registrar } from "@/lib/auditoria";
import { consolidar, situacaoParcela } from "@/lib/honorarios/regras";
import { deDecimal, formatarBRL, formatarCentavos } from "@/lib/honorarios/dinheiro";
import { dataBR, hojeISO, iso } from "@/lib/tempo";
import {
  FORMA_PAGAMENTO, MODALIDADE_HONORARIOS, NATUREZA_HONORARIOS, STATUS_PARCELA, UNIDADE, rotulo,
} from "@/lib/rotulos";
import { FormularioLancamento, FormularioPagamento, FormularioStatusParcela } from "../formularios";
import { encerrarContrato, marcarRecebido } from "../acoes";
import { contratoVisivel } from "../consulta";

export const metadata = { title: "Contrato de honorários — HRS Interno" };

export default async function FichaContrato({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ parcela?: string; acao?: string }>;
}) {
  const usuario = await exigirPermissao("financeiro", "ler");
  const { id } = await params;
  const { parcela: parcelaSelecionada, acao } = await searchParams;
  if (!(await contratoVisivel(usuario, id))) notFound();

  const contrato = await prisma.contratoHonorarios.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true } },
      processos: { include: { processo: { select: { id: true, numeroCnj: true } } } },
      parcelas: { orderBy: { numero: "asc" } },
      lancamentos: { orderBy: { dataReconhecimento: "desc" }, include: { processo: { select: { numeroCnj: true } } } },
    },
  });
  if (!contrato) notFound();

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "LEITURA",
    entidade: "contrato_honorarios",
    entidadeId: contrato.id,
    descricao: "Contrato de honorários consultado",
  });

  const hoje = hojeISO();
  const podeEditar = pode(usuario.perfil, "financeiro", "editar");
  const consolidado = consolidar(
    contrato.lancamentos.map((l) => ({ natureza: l.natureza, valorCentavos: deDecimal(l.valor), provisao: l.provisao, recebido: l.recebido })),
  );
  const totalParcelas = contrato.parcelas.reduce((s, p) => s + deDecimal(p.valor), 0);
  const totalPago = contrato.parcelas.filter((p) => p.status === "PAGO").reduce((s, p) => s + deDecimal(p.valorPago ?? p.valor), 0);

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Contrato — {contrato.cliente.nome}</h1>
        <p className="legenda">
          <Link href={`/clientes/${contrato.cliente.id}`}>ficha do cliente</Link> · {rotulo(MODALIDADE_HONORARIOS, contrato.modalidade)} ·{" "}
          {rotulo(UNIDADE, contrato.unidade)} · {contrato.ativo ? "ativo" : "encerrado"}
        </p>

        <div className="cartao">
          <p style={{ marginTop: 0 }}><strong>Objeto:</strong> {contrato.objeto}</p>
          <div className="linha">
            {contrato.valorFixo && <div><strong>Valor fixo</strong><div>{formatarBRL(deDecimal(contrato.valorFixo))}</div></div>}
            {contrato.valorProLabore && <div><strong>Pró-labore</strong><div>{formatarBRL(deDecimal(contrato.valorProLabore))}</div></div>}
            {contrato.valorMensal && <div><strong>Mensalidade</strong><div>{formatarBRL(deDecimal(contrato.valorMensal))}</div></div>}
            {contrato.percentualExito && <div><strong>Êxito</strong><div>{String(contrato.percentualExito)}%</div></div>}
            <div><strong>Assinatura</strong><div>{dataBR(contrato.dataAssinatura)}</div></div>
            <div><strong>Vigência</strong><div>{dataBR(contrato.vigenciaInicio)} a {contrato.vigenciaFim ? dataBR(contrato.vigenciaFim) : "indeterminado"}</div></div>
          </div>
          <p style={{ marginBottom: 0 }}>
            <strong>Processos:</strong>{" "}
            {contrato.processos.length === 0 ? "nenhum vinculado" : contrato.processos.map((p, i) => (
              <span key={p.processoId}>{i > 0 && ", "}<Link href={`/processos/${p.processo.id}`}>{p.processo.numeroCnj}</Link></span>
            ))}
          </p>
        </div>

        <h2>Parcelas</h2>
        {contrato.parcelas.length === 0 ? (
          <p className="vazio">Sem parcelamento cadastrado.</p>
        ) : (
          <div className="rolagem">
            <table>
              <thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Pagamento</th><th></th></tr></thead>
              <tbody>
                {contrato.parcelas.map((p) => {
                  const sit = situacaoParcela({ status: p.status, vencimento: iso(p.vencimento) }, hoje);
                  return (
                    <tr key={p.id}>
                      <td>{p.numero}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{dataBR(p.vencimento)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatarBRL(deDecimal(p.valor))}</td>
                      <td>
                        <span className={`etiqueta ${sit === "EM_ATRASO" ? "etiqueta-alerta" : sit === "A_VENCER" ? "etiqueta-pendente" : ""}`}>
                          {rotulo(STATUS_PARCELA, sit)}
                        </span>
                      </td>
                      <td>
                        {p.status === "PAGO"
                          ? `${dataBR(p.pagoEm)} · ${formatarBRL(deDecimal(p.valorPago))} · ${rotulo(FORMA_PAGAMENTO, p.formaPagamento ?? "")}`
                          : p.observacao ?? "—"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {p.status === "PAGO" && <Link href={`/honorarios/parcelas/${p.id}/recibo`}>recibo</Link>}
                        {podeEditar && (sit === "A_VENCER" || sit === "EM_ATRASO") && (
                          <>
                            <Link href={`/honorarios/${contrato.id}?parcela=${p.id}&acao=pagar`}>baixar</Link>
                            {" · "}
                            <Link href={`/honorarios/${contrato.id}?parcela=${p.id}&acao=status`}>alterar</Link>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}><strong>Total</strong></td><td><strong>{formatarBRL(totalParcelas)}</strong></td><td colSpan={3}>pago: {formatarBRL(totalPago)}</td></tr>
              </tfoot>
            </table>
          </div>
        )}

        {podeEditar && parcelaSelecionada && acao === "pagar" && (() => {
          const p = contrato.parcelas.find((x) => x.id === parcelaSelecionada);
          return p ? (
            <>
              <h2>Baixar parcela {p.numero}</h2>
              <FormularioPagamento parcelaId={p.id} valorSugerido={formatarCentavos(deDecimal(p.valor))} hoje={hoje} />
            </>
          ) : null;
        })()}
        {podeEditar && parcelaSelecionada && acao === "status" && (
          <>
            <h2>Alterar situação da parcela</h2>
            <FormularioStatusParcela parcelaId={parcelaSelecionada} />
          </>
        )}

        <h2>Lançamentos por natureza</h2>
        <p className="legenda">
          Sucumbência, contratual e destacado são naturezas distintas: o sistema não as soma num total único.
          Provisão de êxito é expectativa e fica em coluna própria.
        </p>
        <div className="rolagem">
          <table>
            <thead><tr><th>Natureza</th><th>Realizado</th><th>A receber</th><th>Provisionado</th></tr></thead>
            <tbody>
              {(["CONTRATUAL", "SUCUMBENCIA", "CONTRATUAL_DESTACADO"] as const).map((n) => (
                <tr key={n}>
                  <td>{rotulo(NATUREZA_HONORARIOS, n)}</td>
                  <td>{formatarBRL(consolidado[n].realizadoCentavos)}</td>
                  <td>{formatarBRL(consolidado[n].aReceberCentavos)}</td>
                  <td>{formatarBRL(consolidado[n].provisionadoCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {contrato.lancamentos.length > 0 && (
          <div className="rolagem">
            <table>
              <thead><tr><th>Data</th><th>Natureza</th><th>Descrição</th><th>Valor</th><th>Situação</th><th></th></tr></thead>
              <tbody>
                {contrato.lancamentos.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{dataBR(l.dataReconhecimento)}</td>
                    <td>{rotulo(NATUREZA_HONORARIOS, l.natureza)}</td>
                    <td>{l.descricao ?? "—"}{l.processo ? ` · ${l.processo.numeroCnj}` : ""}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatarBRL(deDecimal(l.valor))}</td>
                    <td>
                      {l.provisao ? <span className="etiqueta etiqueta-pendente">provisão</span>
                        : l.recebido ? `recebido em ${dataBR(l.recebidoEm)}` : <span className="etiqueta">a receber</span>}
                    </td>
                    <td>
                      {podeEditar && !l.provisao && !l.recebido && (
                        <form action={async (fd) => { "use server"; await marcarRecebido(l.id, String(fd.get("recebidoEm") ?? "")); }}
                          style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                          <input type="date" name="recebidoEm" defaultValue={hoje} required style={{ width: "auto" }} />
                          <button className="botao-secundario" type="submit">recebido</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pode(usuario.perfil, "financeiro", "criar") && (
          <>
            <h2>Novo lançamento</h2>
            <FormularioLancamento
              contratoId={contrato.id}
              processos={contrato.processos.map((p) => ({ id: p.processo.id, rotulo: p.processo.numeroCnj }))}
              unidadePadrao={contrato.unidade}
              hoje={hoje}
            />
          </>
        )}

        {contrato.ativo && pode(usuario.perfil, "financeiro", "inativar") && (
          <div className="acoes">
            <form action={async () => { "use server"; await encerrarContrato(contrato.id); }}>
              <button className="botao-secundario" type="submit">Encerrar contrato</button>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
