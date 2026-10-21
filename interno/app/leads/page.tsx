import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { dataBR, dataHoraBR } from "@/lib/tempo";
import { ORIGEM_SIMULADOR, STATUS_LEAD, rotulo } from "@/lib/rotulos";
import { atualizarLead } from "./acoes";

export const metadata = { title: "Leads — HRS Interno" };

export default async function Leads({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const usuario = await exigirPermissao("cliente", "ler");
  const { status } = await searchParams;

  const [leads, advogados, contagens] = await Promise.all([
    prisma.lead.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: [{ solicitouContato: "desc" }, { criadoEm: "desc" }],
      take: 200,
      include: { responsavel: { select: { nome: true } }, clienteConvertido: { select: { id: true, nome: true } } },
    }),
    prisma.usuario.findMany({ where: { perfil: { in: ["SOCIO", "ADVOGADO"] }, ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
  ]);

  const contagem = (s: string) => contagens.find((c) => c.status === s)?._count ?? 0;
  const podeEditar = pode(usuario.perfil, "cliente", "editar");

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Leads dos simuladores</h1>
        <p className="legenda">
          Quem usou um simulador do site. Base legal: consentimento (LGPD art. 7º, I).
        </p>

        <div className="aviso aviso-atencao">
          <strong>Não existe disparo automático.</strong> O Provimento 205/2021 do CFOAB veda a captação de
          clientela: o escritório só pode responder a quem <em>pediu</em> contato, e o pedido precisa estar
          datado. Lead sem consentimento aparece aqui para que se saiba que existe — e para que{" "}
          <strong>não</strong> seja procurado.
        </div>

        <div className="grade">
          <div className="indicador">
            <div className="rotulo">Aguardando contato</div>
            <div className="numero">{contagem("AGUARDANDO_CONTATO")}</div>
          </div>
          <div className="indicador">
            <div className="rotulo">Em contato</div>
            <div className="numero">{contagem("EM_CONTATO")}</div>
          </div>
          <div className="indicador">
            <div className="rotulo">Convertidos</div>
            <div className="numero">{contagem("CONVERTIDO")}</div>
          </div>
          <div className="indicador">
            <div className="rotulo">Sem consentimento</div>
            <div className="numero" style={{ color: "var(--tinta-suave)" }}>{contagem("SEM_CONSENTIMENTO")}</div>
            <div className="legenda" style={{ margin: 0, fontSize: ".8rem" }}>não contatar</div>
          </div>
        </div>

        <div className="acoes">
          {pode(usuario.perfil, "cliente", "criar") && <Link className="botao" href="/leads/importar">Importar planilha</Link>}
          <Link className="botao-secundario" href="/leads">Todos</Link>
          <Link className="botao-secundario" href="/leads?status=AGUARDANDO_CONTATO">Aguardando contato</Link>
        </div>

        {leads.length === 0 ? <p className="vazio">Nenhum lead cadastrado.</p> : (
          <div className="rolagem">
            <table>
              <thead>
                <tr><th>Recebido</th><th>Nome</th><th>Simulador</th><th>Consentimento</th><th>Situação</th><th>Responsável</th><th></th></tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} style={l.solicitouContato ? undefined : { opacity: .6 }}>
                    <td style={{ whiteSpace: "nowrap" }}>{dataHoraBR(l.criadoEm)}</td>
                    <td>
                      {l.nome}
                      {l.solicitouContato && <><br /><small>{l.whatsapp}{l.email ? ` · ${l.email}` : ""}</small></>}
                    </td>
                    <td>{rotulo(ORIGEM_SIMULADOR, l.simulador)}</td>
                    <td>
                      {l.consentimentoEm
                        ? <>sim, em {dataBR(l.consentimentoEm)}</>
                        : <span className="etiqueta etiqueta-alerta">não consta</span>}
                    </td>
                    <td>{rotulo(STATUS_LEAD, l.status)}</td>
                    <td>
                      {l.clienteConvertido
                        ? <Link href={`/clientes/${l.clienteConvertido.id}`}>{l.clienteConvertido.nome}</Link>
                        : l.responsavel?.nome ?? "—"}
                    </td>
                    <td>
                      {podeEditar && l.solicitouContato && l.status === "AGUARDANDO_CONTATO" && (
                        <form action={async (fd) => {
                          "use server";
                          await atualizarLead(l.id, { status: "EM_CONTATO", responsavelId: String(fd.get("responsavelId") ?? "") || null });
                        }} style={{ display: "flex", gap: ".4rem" }}>
                          <select name="responsavelId" defaultValue={advogados[0]?.id ?? ""} style={{ width: "auto" }}>
                            {advogados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                          </select>
                          <button className="botao-secundario" type="submit">assumir</button>
                        </form>
                      )}
                      {podeEditar && !l.solicitouContato && l.status !== "DESCARTADO" && (
                        <form action={async () => { "use server"; await atualizarLead(l.id, { status: "DESCARTADO" }); }}>
                          <button className="botao-secundario" type="submit">descartar</button>
                        </form>
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
