import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { alertasDeLogistica, ANTECEDENCIA_LOGISTICA_DIAS } from "@/lib/agenda/regras";
import { dataHoraBR, hojeISO } from "@/lib/tempo";
import { STATUS_COMPROMISSO, TIPO_COMPROMISSO, UNIDADE, rotulo } from "@/lib/rotulos";
import { mudarStatusCompromisso } from "./acoes";

export const metadata = { title: "Agenda — HRS Interno" };

export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<{ responsavel?: string }>;
}) {
  const usuario = await exigirPermissao("agenda", "ler");
  const { responsavel } = await searchParams;
  const hoje = hojeISO();
  const inicio = new Date(`${hoje}T00:00:00Z`);

  const [compromissos, advogados] = await Promise.all([
    prisma.compromisso.findMany({
      where: {
        dataHora: { gte: new Date(inicio.getTime() - 7 * 86_400_000) },
        ...(responsavel ? { responsavelId: responsavel } : {}),
      },
      orderBy: { dataHora: "asc" },
      take: 200,
      include: {
        responsavel: { select: { id: true, nome: true } },
        processo: { select: { id: true, numeroCnj: true } },
      },
    }),
    prisma.usuario.findMany({ where: { perfil: { in: ["SOCIO", "ADVOGADO", "ESTAGIARIO"] }, ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const alertas = alertasDeLogistica(compromissos, hoje);
  const podeEditar = pode(usuario.perfil, "agenda", "editar");

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Agenda</h1>
        <p className="legenda">
          Audiências, perícias e reuniões. O escritório atua em três praças: deslocamento se resolve com
          antecedência, não na véspera.
        </p>

        {alertas.length > 0 && (
          <div className="aviso aviso-atencao">
            <strong>Logística nos próximos {ANTECEDENCIA_LOGISTICA_DIAS} dias:</strong>
            <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.2rem" }}>
              {alertas.map((a) => (
                <li key={a.compromisso.id}>
                  {a.diasRestantes === 0 ? "hoje" : `em ${a.diasRestantes} dia(s)`} — {a.compromisso.titulo} em{" "}
                  {a.compromisso.municipio}/{a.compromisso.uf} ({a.compromisso.responsavel.nome}, lotado em{" "}
                  {rotulo(UNIDADE, a.compromisso.unidadeResponsavel)})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="acoes">
          {pode(usuario.perfil, "agenda", "criar") && <Link className="botao" href="/agenda/novo">Novo compromisso</Link>}
          <Link className="botao-secundario" href={`/agenda/ical${responsavel ? `?responsavel=${responsavel}` : ""}`}>Exportar .ics</Link>
        </div>

        <form className="formulario" method="get">
          <label>
            <span>Responsável</span>
            <select name="responsavel" defaultValue={responsavel ?? ""}>
              <option value="">Todos</option>
              {advogados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
          <div className="acoes"><button className="botao-secundario" type="submit">Filtrar</button></div>
        </form>

        {compromissos.length === 0 ? <p className="vazio">Nenhum compromisso agendado.</p> : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Quando</th><th>Compromisso</th><th>Local</th><th>Responsável</th><th>Situação</th><th></th></tr></thead>
              <tbody>
                {compromissos.map((c) => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{dataHoraBR(c.dataHora)}</td>
                    <td>
                      {rotulo(TIPO_COMPROMISSO, c.tipo)}: {c.titulo}
                      {c.processo && <><br /><small><Link href={`/processos/${c.processo.id}`}>{c.processo.numeroCnj}</Link></small></>}
                    </td>
                    <td>
                      {c.virtual ? "Virtual" : <>{c.municipio}/{c.uf}{c.forum ? <><br /><small>{c.forum}</small></> : null}</>}
                      {c.exigeDeslocamento && <> <span className="etiqueta etiqueta-pendente">deslocamento</span></>}
                    </td>
                    <td>{c.responsavel.nome}</td>
                    <td>{rotulo(STATUS_COMPROMISSO, c.status)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {podeEditar && c.status === "AGENDADO" && (
                        <div style={{ display: "flex", gap: ".3rem" }}>
                          <form action={async () => { "use server"; await mudarStatusCompromisso(c.id, "REALIZADO"); }}>
                            <button className="botao-secundario" type="submit">realizado</button>
                          </form>
                          <form action={async () => { "use server"; await mudarStatusCompromisso(c.id, "ADIADO"); }}>
                            <button className="botao-secundario" type="submit">adiado</button>
                          </form>
                        </div>
                      )}
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
