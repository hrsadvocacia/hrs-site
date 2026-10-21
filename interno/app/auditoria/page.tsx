import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { dataHoraBR } from "@/lib/tempo";
import { ACAO_AUDITORIA, rotulo } from "@/lib/rotulos";

export const metadata = { title: "Auditoria — HRS Interno" };

export default async function Auditoria({
  searchParams,
}: {
  searchParams: Promise<{ acao?: string; usuario?: string; entidade?: string; pagina?: string }>;
}) {
  const usuario = await exigirPermissao("auditoria", "ler");
  const { acao, usuario: usuarioFiltro, entidade, pagina } = await searchParams;
  const paginaAtual = Math.max(1, Number(pagina ?? "1") || 1);
  const porPagina = 100;

  const where = {
    ...(acao ? { acao: acao as never } : {}),
    ...(usuarioFiltro ? { usuarioId: usuarioFiltro } : {}),
    ...(entidade ? { entidade } : {}),
  };

  const [registros, total, usuarios] = await Promise.all([
    prisma.auditoria.findMany({
      where,
      orderBy: { ocorridoEm: "desc" },
      skip: (paginaAtual - 1) * porPagina,
      take: porPagina,
      include: { usuario: { select: { nome: true } } },
    }),
    prisma.auditoria.count({ where }),
    prisma.usuario.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const query = new URLSearchParams({
    ...(acao ? { acao } : {}), ...(usuarioFiltro ? { usuario: usuarioFiltro } : {}), ...(entidade ? { entidade } : {}),
  });

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Auditoria</h1>
        <p className="legenda">
          Registro imutável de quem fez o quê e quando. A tabela é <em>append-only</em> no banco: nem a
          aplicação nem um script consegue alterar ou apagar linha — {total.toLocaleString("pt-BR")} registros.
        </p>

        <div className="aviso aviso-atencao">
          O log responde <strong>quem fez o quê</strong>, nunca <em>qual era o conteúdo</em>. Dado pessoal de
          cliente não entra aqui — há validação que recusa a gravação de CPF, e-mail ou telefone na descrição.
        </div>

        <form className="formulario" method="get">
          <div className="linha">
            <label>
              <span>Ação</span>
              <select name="acao" defaultValue={acao ?? ""}>
                <option value="">Todas</option>
                {Object.entries(ACAO_AUDITORIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>
              <span>Usuário</span>
              <select name="usuario" defaultValue={usuarioFiltro ?? ""}>
                <option value="">Todos</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
            <label>
              <span>Entidade</span>
              <input name="entidade" defaultValue={entidade ?? ""} placeholder="prazo, cliente, documento..." />
            </label>
          </div>
          <div className="acoes">
            <button className="botao-secundario" type="submit">Filtrar</button>
            {pode(usuario.perfil, "auditoria", "exportar") && (
              <Link className="botao-secundario" href={`/auditoria/exportar?${query.toString()}`}>Exportar CSV</Link>
            )}
          </div>
        </form>

        <div className="rolagem">
          <table>
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Entidade</th><th>Descrição</th><th>IP</th></tr></thead>
            <tbody>
              {registros.map((r) => (
                <tr key={String(r.id)} style={r.sucesso ? undefined : { background: "var(--alerta-fundo)" }}>
                  <td style={{ whiteSpace: "nowrap" }}>{dataHoraBR(r.ocorridoEm)}</td>
                  <td>{r.usuario?.nome ?? r.usuarioEmail}</td>
                  <td>{rotulo(ACAO_AUDITORIA, r.acao)}</td>
                  <td>{r.entidade}</td>
                  <td>
                    {r.descricao}
                    {r.camposAlterados.length > 0 && <><br /><small>campos: {r.camposAlterados.join(", ")}</small></>}
                  </td>
                  <td><small>{r.ip ?? "—"}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="acoes">
          {paginaAtual > 1 && (
            <Link className="botao-secundario" href={`/auditoria?${query}&pagina=${paginaAtual - 1}`}>← anteriores</Link>
          )}
          {paginaAtual * porPagina < total && (
            <Link className="botao-secundario" href={`/auditoria?${query}&pagina=${paginaAtual + 1}`}>próximos →</Link>
          )}
        </div>
      </main>
    </>
  );
}
