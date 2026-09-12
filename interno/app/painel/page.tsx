import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/auditoria";
import { cargaPorAdvogado, conversao, funil, resumoDeRisco } from "@/lib/painel/indicadores";
import { consolidar } from "@/lib/honorarios/regras";
import { deDecimal, formatarBRL } from "@/lib/honorarios/dinheiro";
import { hojeISO, iso } from "@/lib/tempo";
import { NATUREZA_HONORARIOS, UNIDADE, rotulo } from "@/lib/rotulos";

export const metadata = { title: "Painel do sócio — HRS Interno" };

export default async function PainelSocio({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const usuario = await exigirPermissao("relatorioSocio", "ler");
  const { de, ate } = await searchParams;
  const hoje = hojeISO();
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(de ?? "") ? de! : `${hoje.slice(0, 4)}-01-01`;
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(ate ?? "") ? ate! : hoje;

  const [prazos, lancamentos, leads, clientesComProcesso, publicacoesOrfas, capturasFalhas] = await Promise.all([
    prisma.prazo.findMany({
      select: {
        id: true, status: true, dataFatal: true, cumpridoEm: true,
        responsavelId: true, responsavel: { select: { nome: true } },
      },
    }),
    prisma.lancamentoHonorarios.findMany({
      where: { dataReconhecimento: { gte: new Date(`${inicio}T00:00:00Z`), lte: new Date(`${fim}T00:00:00Z`) } },
      select: { natureza: true, valor: true, provisao: true, recebido: true, unidade: true },
    }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.cliente.count({ where: { ativo: true, processos: { some: { processo: { situacao: "EM_ANDAMENTO" } } } } }),
    prisma.publicacao.count({ where: { status: "ORFA" } }),
    prisma.capturaDiaria.count({ where: { status: "FALHA" } }),
  ]);

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "LEITURA",
    entidade: "relatorio_socio",
    descricao: `Painel do sócio consultado (${inicio} a ${fim})`,
  });

  const paraIndicador = prazos.map((p) => ({
    id: p.id,
    status: p.status,
    dataFatal: iso(p.dataFatal),
    cumpridoEm: p.cumpridoEm ? iso(p.cumpridoEm) : null,
    responsavelId: p.responsavelId,
    responsavelNome: p.responsavel.nome,
  }));
  const risco = resumoDeRisco(paraIndicador, hoje);
  const carga = cargaPorAdvogado(paraIndicador, hoje);

  const financeiro = consolidar(
    lancamentos.map((l) => ({ natureza: l.natureza, valorCentavos: deDecimal(l.valor), provisao: l.provisao, recebido: l.recebido })),
  );
  const porUnidade = (["GOIANIA", "TERESINA", "TIMON"] as const).map((u) => {
    const ls = lancamentos.filter((l) => l.unidade === u);
    const c = consolidar(ls.map((l) => ({ natureza: l.natureza, valorCentavos: deDecimal(l.valor), provisao: l.provisao, recebido: l.recebido })));
    return {
      unidade: u,
      realizado: c.CONTRATUAL.realizadoCentavos + c.SUCUMBENCIA.realizadoCentavos + c.CONTRATUAL_DESTACADO.realizadoCentavos,
    };
  });

  const cont = (s: string) => leads.find((l) => l.status === s)?._count ?? 0;
  const etapas = funil({
    leadsComConsentimento: cont("AGUARDANDO_CONTATO") + cont("EM_CONTATO") + cont("CONVERTIDO"),
    leadsEmContato: cont("EM_CONTATO") + cont("CONVERTIDO"),
    leadsConvertidos: cont("CONVERTIDO"),
    clientesComProcesso,
  });

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Painel do sócio</h1>
        <p className="legenda">Risco de prazo, carga por advogado, faturamento e funil.</p>

        {(risco.vencidosSemBaixa > 0 || capturasFalhas > 0) && (
          <div className="aviso aviso-erro">
            <strong>Atenção imediata.</strong>
            <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>
              {risco.vencidosSemBaixa > 0 && (
                <li>{risco.vencidosSemBaixa} prazo(s) com data fatal ultrapassada e sem baixa registrada — <Link href="/prazos">ver</Link></li>
              )}
              {capturasFalhas > 0 && (
                <li>{capturasFalhas} captura(s) de publicação em falha — <Link href="/publicacoes">ver</Link></li>
              )}
            </ul>
          </div>
        )}

        <h2>Risco de prazo</h2>
        <div className="grade">
          <div className="indicador">
            <div className="rotulo">Prazos em curso</div>
            <div className="numero">{risco.emCurso}</div>
          </div>
          <div className="indicador" style={risco.pendentesConferencia ? { borderTopColor: "var(--atencao)" } : undefined}>
            <div className="rotulo">Pendentes de conferência</div>
            <div className="numero" style={risco.pendentesConferencia ? { color: "var(--atencao)" } : undefined}>{risco.pendentesConferencia}</div>
          </div>
          <div className="indicador" style={risco.perdidos ? { borderTopColor: "var(--alerta)" } : undefined}>
            <div className="rotulo">Prazos perdidos</div>
            <div className="numero" style={risco.perdidos ? { color: "var(--alerta)" } : undefined}>{risco.perdidos}</div>
          </div>
          <div className="indicador" style={risco.salvosNoLimite ? { borderTopColor: "var(--atencao)" } : undefined}>
            <div className="rotulo">Salvos no limite</div>
            <div className="numero">{risco.salvosNoLimite}</div>
            <div className="legenda" style={{ margin: 0, fontSize: ".78rem" }}>cumpridos no próprio dia fatal</div>
          </div>
          <div className="indicador" style={publicacoesOrfas ? { borderTopColor: "var(--atencao)" } : undefined}>
            <div className="rotulo">Publicações órfãs</div>
            <div className="numero">{publicacoesOrfas}</div>
          </div>
        </div>
        <p className="legenda">
          <strong>&quot;Salvos no limite&quot; é indicador de risco, não de eficiência.</strong> Prazo cumprido
          no próprio dia fatal significa que a margem foi consumida inteira: qualquer atraso na captura, naquele
          caso, teria virado prazo perdido.
        </p>

        <h2>Carga por advogado</h2>
        {carga.length === 0 ? <p className="vazio">Nenhum prazo cadastrado.</p> : (
          <div className="rolagem">
            <table>
              <thead>
                <tr><th>Advogado</th><th>Em curso</th><th>Vencem em 7 dias</th><th>Pendentes de conferência</th><th>Salvos no limite</th><th>Perdidos</th></tr>
              </thead>
              <tbody>
                {carga.map((c) => (
                  <tr key={c.responsavelId}>
                    <td>{c.nome}</td>
                    <td>{c.emCurso}</td>
                    <td>{c.vencendoEm7Dias}</td>
                    <td>{c.pendentesConferencia > 0 ? <span className="etiqueta etiqueta-pendente">{c.pendentesConferencia}</span> : "—"}</td>
                    <td>{c.salvosNoLimite || "—"}</td>
                    <td>{c.perdidos > 0 ? <span className="etiqueta etiqueta-alerta">{c.perdidos}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Faturamento</h2>
        <form className="formulario" method="get">
          <div className="linha">
            <label><span>De</span><input type="date" name="de" defaultValue={inicio} /></label>
            <label><span>Até</span><input type="date" name="ate" defaultValue={fim} /></label>
          </div>
          <div className="acoes"><button className="botao-secundario" type="submit">Aplicar</button></div>
        </form>
        <div className="rolagem">
          <table>
            <thead><tr><th>Natureza</th><th>Realizado</th><th>A receber</th><th>Provisão</th></tr></thead>
            <tbody>
              {(["CONTRATUAL", "SUCUMBENCIA", "CONTRATUAL_DESTACADO"] as const).map((n) => (
                <tr key={n}>
                  <td>{rotulo(NATUREZA_HONORARIOS, n)}</td>
                  <td>{formatarBRL(financeiro[n].realizadoCentavos)}</td>
                  <td>{formatarBRL(financeiro[n].aReceberCentavos)}</td>
                  <td style={{ color: "var(--tinta-suave)" }}>{formatarBRL(financeiro[n].provisionadoCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grade">
          {porUnidade.map((u) => (
            <div className="indicador" key={u.unidade}>
              <div className="rotulo">{rotulo(UNIDADE, u.unidade)}</div>
              <div className="numero" style={{ fontSize: "1.4rem" }}>{formatarBRL(u.realizado)}</div>
              <div className="legenda" style={{ margin: 0, fontSize: ".78rem" }}>recebido no período</div>
            </div>
          ))}
        </div>

        <h2>Funil de origem</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Etapa</th><th>Quantidade</th><th>Conversão da etapa anterior</th></tr></thead>
            <tbody>
              {etapas.map((e, i) => (
                <tr key={e.etapa}>
                  <td>{e.etapa}</td>
                  <td>{e.quantidade}</td>
                  <td>{i === 0 ? "—" : conversao(etapas[i - 1]!.quantidade, e.quantidade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="legenda">
          Leads sem consentimento ficam fora do funil de propósito: não são oportunidade perdida, são pessoas
          que não pediram para ser procuradas (Prov. 205/2021).
        </p>
      </main>
    </>
  );
}
