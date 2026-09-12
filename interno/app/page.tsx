import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirUsuario } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { severidade } from "@/lib/prazos/alertas";
import { alertasDeLogistica } from "@/lib/agenda/regras";
import { reguaCobranca } from "@/lib/honorarios/regras";
import { pendenciasDeCaptura, resumirPendencias, pendenciasDeDomicilio, domicilioEmAlerta, ultimoDiaUtil } from "@/lib/publicacoes/vigilancia";
import { somarDias, formatarBR, type DataISO } from "@/lib/prazos/dias";
import { hojeISO, iso, dataBR, dataHoraBR } from "@/lib/tempo";
import { TIPO_COMPROMISSO, UNIDADE, rotulo } from "@/lib/rotulos";

export const metadata = { title: "Painel — HRS Interno" };

const UNIDADES = ["GOIANIA", "TERESINA", "TIMON"] as const;

/**
 * Painel inicial.
 *
 * A ordem das seções é a ordem do risco, não a do organograma: primeiro o que
 * pode fazer o escritório perder prazo (captura parada, Domicílio sem
 * conferência, prazo pendente de confirmação, prazo vencido sem baixa), depois
 * o que vence hoje, depois a agenda e o financeiro.
 *
 * Enquanto a captura automática não estiver verificada, o painel DIZ isso: a
 * ausência de alerta nunca pode ser lida como ausência de prazo.
 */
export default async function Painel() {
  const usuario = await exigirUsuario();
  const hoje = hojeISO();
  const vePrazos = pode(usuario.perfil, "prazo", "ler");
  const veFinanceiro = pode(usuario.perfil, "financeiro", "ler");
  const veAgenda = pode(usuario.perfil, "agenda", "ler");
  const vePublicacoes = pode(usuario.perfil, "publicacao", "ler");

  const [prazos, capturas, checklists, compromissos, parcelas, inscricoes] = await Promise.all([
    vePrazos
      ? prisma.prazo.findMany({
          where: { status: { in: ["PENDENTE_CONFERENCIA", "CONFIRMADO", "EM_TRATATIVA"] } },
          orderBy: { dataFatal: "asc" },
          include: {
            processo: { select: { id: true, numeroCnj: true } },
            responsavel: { select: { id: true, nome: true } },
            _count: { select: { tratativas: true } },
          },
        })
      : [],
    vePublicacoes
      ? prisma.capturaDiaria.findMany({
          where: { data: { gte: new Date(`${somarDias(hoje, -14)}T00:00:00Z`) } },
          select: { data: true, inscricaoOabId: true, status: true, confirmadaPorId: true },
        })
      : [],
    vePublicacoes
      ? prisma.checklistDomicilio.findMany({ where: { data: { gte: new Date(`${somarDias(hoje, -14)}T00:00:00Z`) } } })
      : [],
    veAgenda
      ? prisma.compromisso.findMany({
          where: { status: "AGENDADO", dataHora: { gte: new Date(`${hoje}T00:00:00Z`) } },
          orderBy: { dataHora: "asc" },
          take: 30,
          include: { responsavel: { select: { nome: true } } },
        })
      : [],
    veFinanceiro
      ? prisma.parcela.findMany({ where: { status: "A_VENCER", contrato: { ativo: true } }, include: { contrato: { select: { id: true, cliente: { select: { nome: true } } } } } })
      : [],
    vePublicacoes
      ? prisma.inscricaoOab.findMany({ where: { monitorada: true, ativa: true }, select: { id: true, numero: true, uf: true } })
      : [],
  ]);

  const meus = prazos.filter((p) => p.responsavelId === usuario.id);
  const pendentes = prazos.filter((p) => p.status === "PENDENTE_CONFERENCIA");
  const vencidos = prazos.filter((p) => iso(p.dataFatal) < hoje);
  const vencemHoje = prazos.filter((p) => iso(p.dataFatal) === hoje);
  const proximos = prazos.filter((p) => {
    const d = iso(p.dataFatal);
    return d > hoje && d <= somarDias(hoje, 7);
  });

  // Rótulo legível da inscrição: o resumo trabalha com o id, mas quem lê o
  // painel precisa ver "12345/GO".
  const rotuloInscricao = new Map(inscricoes.map((i) => [i.id, `${i.numero}/${i.uf}`]));
  const pendenciasCaptura = vePublicacoes
    ? resumirPendencias(
        pendenciasDeCaptura({
          inscricoesMonitoradas: inscricoes.map((i) => i.id),
          batimentos: capturas.map((c) => ({
            inscricaoOabId: c.inscricaoOabId,
            data: iso(c.data),
            status: c.status,
            confirmadaPorId: c.confirmadaPorId,
          })),
          de: somarDias(hoje, -14) as DataISO,
          ate: ultimoDiaUtil(hoje),
        }),
      )
    : [];

  const pendenciasDomicilio = vePublicacoes
    ? pendenciasDeDomicilio({
        unidades: [...UNIDADES],
        confirmacoes: checklists.map((c) => ({ data: iso(c.data), unidade: c.unidade, confirmadoEm: c.confirmadoEm })),
        de: somarDias(hoje, -14) as DataISO,
        ate: hoje,
      })
    : [];

  const logistica = veAgenda ? alertasDeLogistica(compromissos, hoje) : [];
  const cobranca = veFinanceiro
    ? reguaCobranca(parcelas.map((p) => ({ ...p, vencimento: iso(p.vencimento) })), hoje)
    : [];
  const atrasadas = cobranca.filter((c) => c.marco.startsWith("ATRASO"));

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Painel</h1>
        <p className="legenda">Bem-vinda(o), {usuario.nome.split(" ")[0]}. Hoje é {formatarBR(hoje)}.</p>

        {vePublicacoes && (
          <div className="aviso aviso-atencao">
            <strong>A captura automática de publicações ainda não está ligada.</strong> O adaptador do DJEN
            aguarda a verificação do contrato real da API. Até lá, publicação e prazo continuam sendo
            conferidos pelo procedimento do escritório — a ausência de alerta aqui{" "}
            <strong>não significa</strong> ausência de prazo.
          </div>
        )}

        {(vencidos.length > 0 || pendenciasCaptura.length > 0 || domicilioEmAlerta(pendenciasDomicilio)) && (
          <div className="aviso aviso-erro">
            <strong>Exige providência hoje:</strong>
            <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>
              {vencidos.length > 0 && (
                <li>{vencidos.length} prazo(s) com data fatal ultrapassada e sem baixa — <Link href="/prazos">ver</Link></li>
              )}
              {pendenciasCaptura.map((p) => (
                <li key={`${p.inscricaoOabId}-${p.situacao}`}>
                  Captura da OAB {rotuloInscricao.get(p.inscricaoOabId) ?? "—"}: {p.dias} dia(s) útil(eis) sem
                  registro completo, de {formatarBR(p.desde)} a {formatarBR(p.ate)} —{" "}
                  <Link href="/publicacoes">ver</Link>
                </li>
              ))}
              {domicilioEmAlerta(pendenciasDomicilio) && (
                <li>Domicílio Judicial sem conferência há mais de um dia útil — <Link href="/domicilio">conferir</Link></li>
              )}
            </ul>
          </div>
        )}

        {vePrazos && (
          <>
            <div className="grade">
              <div className="indicador" style={vencemHoje.length ? { borderTopColor: "var(--alerta)" } : undefined}>
                <div className="rotulo">Vencem hoje</div>
                <div className="numero" style={vencemHoje.length ? { color: "var(--alerta)" } : undefined}>{vencemHoje.length}</div>
              </div>
              <div className="indicador"><div className="rotulo">Vencem em 7 dias</div><div className="numero">{proximos.length}</div></div>
              <div className="indicador" style={pendentes.length ? { borderTopColor: "var(--atencao)" } : undefined}>
                <div className="rotulo">Pendentes de conferência</div>
                <div className="numero" style={pendentes.length ? { color: "var(--atencao)" } : undefined}>{pendentes.length}</div>
              </div>
              <div className="indicador"><div className="rotulo">Meus prazos em curso</div><div className="numero">{meus.length}</div></div>
            </div>

            {pendentes.length > 0 && (
              <div className="aviso aviso-atencao">
                <strong>{pendentes.length} prazo(s) aguardando conferência de advogado.</strong> Enquanto não
                forem confirmados, não são prazos controlados. O sistema assiste; o advogado decide.
              </div>
            )}

            <h2>Meus prazos mais próximos</h2>
            {meus.length === 0 ? <p className="vazio">Nenhum prazo sob sua responsabilidade.</p> : (
              <div className="rolagem">
                <table>
                  <thead><tr><th>Data fatal</th><th>Ato</th><th>Processo</th><th>Situação</th></tr></thead>
                  <tbody>
                    {meus.slice(0, 10).map((p) => {
                      const grau = severidade({ dataFatal: iso(p.dataFatal), status: p.status }, hoje);
                      return (
                        <tr key={p.id}>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className={grau === "vencido" || grau === "critico" ? "etiqueta etiqueta-alerta" : grau === "atencao" ? "etiqueta etiqueta-pendente" : ""}>
                              {dataBR(p.dataFatal)}
                            </span>
                          </td>
                          <td><Link href={`/prazos/${p.id}`}>{p.titulo}</Link></td>
                          <td>{p.processo.numeroCnj}</td>
                          <td>{p.status === "PENDENTE_CONFERENCIA" ? "aguardando conferência" : p.status === "EM_TRATATIVA" ? "em tratativa" : "confirmado"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {veAgenda && compromissos.length > 0 && (
          <>
            <h2>Próximos compromissos</h2>
            {logistica.length > 0 && (
              <div className="aviso aviso-atencao">
                {logistica.length} compromisso(s) com deslocamento nos próximos 15 dias — passagem, hospedagem
                ou substabelecimento se resolvem agora. <Link href="/agenda">ver agenda</Link>
              </div>
            )}
            <div className="rolagem">
              <table>
                <thead><tr><th>Quando</th><th>Compromisso</th><th>Onde</th><th>Responsável</th></tr></thead>
                <tbody>
                  {compromissos.slice(0, 8).map((c) => (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{dataHoraBR(c.dataHora)}</td>
                      <td>{rotulo(TIPO_COMPROMISSO, c.tipo)}: {c.titulo}</td>
                      <td>
                        {c.virtual ? "virtual" : `${c.municipio}/${c.uf}`}
                        {c.exigeDeslocamento && <> <span className="etiqueta etiqueta-pendente">deslocamento</span></>}
                      </td>
                      <td>{c.responsavel.nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {veFinanceiro && atrasadas.length > 0 && (
          <>
            <h2>Cobrança</h2>
            <p>
              {atrasadas.length} parcela(s) em atraso.{" "}
              <Link href="/honorarios">abrir régua de cobrança</Link>
            </p>
          </>
        )}

        <h2>Atalhos</h2>
        <div className="acoes">
          {pode(usuario.perfil, "prazo", "criar") && <Link className="botao" href="/prazos/novo">Novo prazo</Link>}
          {pode(usuario.perfil, "cliente", "criar") && <Link className="botao-secundario" href="/clientes/novo">Novo cliente</Link>}
          {pode(usuario.perfil, "processo", "criar") && <Link className="botao-secundario" href="/processos/novo">Novo processo</Link>}
          {pode(usuario.perfil, "atendimento", "criar") && <Link className="botao-secundario" href="/atendimentos/novo">Registrar atendimento</Link>}
          {pode(usuario.perfil, "agenda", "criar") && <Link className="botao-secundario" href="/agenda/novo">Novo compromisso</Link>}
        </div>
      </main>
    </>
  );
}
