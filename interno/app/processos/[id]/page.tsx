import { notFound } from "next/navigation";
import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { registrar } from "@/lib/auditoria";
import { descreverSegmentoCnj } from "@/lib/documentos";

export const metadata = { title: "Processo — HRS Interno" };

export default async function DetalheProcesso({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await exigirPermissao("processo", "ler");
  const { id } = await params;

  const processo = await prisma.processo.findUnique({
    where: { id },
    include: {
      tribunal: true,
      orgaoJulgador: true,
      advogadoResponsavel: { select: { nome: true } },
      partes: { include: { cliente: { select: { id: true, nome: true } } } },
      movimentacoes: { orderBy: { data: "desc" }, take: 20 },
    },
  });
  if (!processo) notFound();

  // Anotacao privilegiada e buscada em consulta SEPARADA, executada apenas se o
  // perfil puder le-la. Assim o conteudo protegido por sigilo profissional nao
  // chega nem a sair do banco para quem nao pode ve-lo — o filtro nao depende
  // de a renderizacao lembrar de esconder.
  const podeVerAnotacoes = pode(usuario.perfil, "anotacaoPrivilegiada", "ler");
  const anotacoes = podeVerAnotacoes
    ? await prisma.anotacaoPrivilegiada.findMany({
        where: { processoId: processo.id },
        orderBy: { criadoEm: "desc" },
        include: { autor: { select: { nome: true } } },
      })
    : [];

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "LEITURA",
    entidade: "processo",
    entidadeId: processo.id,
    descricao: "Autos internos consultados",
  });

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>{processo.numeroCnj}</h1>
        <p className="legenda">
          {processo.tribunal.nome}
          {processo.orgaoJulgador
            ? ` — ${processo.orgaoJulgador.nome} (${processo.orgaoJulgador.municipio}/${processo.orgaoJulgador.uf})`
            : ""}
        </p>

        {processo.segredoJustica && (
          <p className="aviso aviso-alerta aviso-erro">
            Processo em segredo de justica. Conteudo restrito.
          </p>
        )}

        <div className="cartao">
          <div className="linha">
            <div><strong>Segmento</strong><div>{descreverSegmentoCnj(processo.cnjSegmento) ?? "—"}</div></div>
            <div><strong>Grau</strong><div>{processo.grau}</div></div>
            <div><strong>Situacao</strong><div>{processo.situacao}</div></div>
            <div><strong>Responsavel</strong><div>{processo.advogadoResponsavel.nome}</div></div>
          </div>
          <div className="linha">
            <div><strong>Classe</strong><div>{processo.classeProcessual ?? "—"}</div></div>
            <div><strong>Assunto</strong><div>{processo.assunto ?? "—"}</div></div>
            <div>
              <strong>Valor da causa</strong>
              <div>
                {processo.valorCausa
                  ? Number(processo.valorCausa).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  : "—"}
              </div>
            </div>
            <div><strong>Unidade</strong><div>{processo.unidade}</div></div>
          </div>
        </div>

        <h2>Partes</h2>
        <div className="rolagem">
          <table>
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Polo</th><th>Advogado adverso</th></tr>
            </thead>
            <tbody>
              {processo.partes.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.cliente ? (
                      <Link href={`/clientes/${p.cliente.id}`}>{p.nome}</Link>
                    ) : (
                      p.nome
                    )}
                  </td>
                  <td>{p.tipo}</td>
                  <td>{p.polo}</td>
                  <td>{p.advogadoAdverso ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Prazos</h2>
        <div className="aviso aviso-atencao">
          Modulo de prazos entra na Fase 1. Ate la, a ausencia de prazo nesta
          tela nao significa que nao exista prazo em curso.
        </div>

        <h2>Movimentacoes</h2>
        {processo.movimentacoes.length === 0 ? (
          <p className="vazio">Nenhuma movimentacao registrada.</p>
        ) : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Data</th><th>Descricao</th><th>Origem</th></tr></thead>
              <tbody>
                {processo.movimentacoes.map((m) => (
                  <tr key={m.id}>
                    <td>{m.data.toLocaleDateString("pt-BR")}</td>
                    <td>{m.descricao}</td>
                    <td>{m.origem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {podeVerAnotacoes && (
          <>
            <h2>
              Estrategia e anotacoes internas{" "}
              <span className="etiqueta etiqueta-alerta">privilegiado</span>
            </h2>
            <p className="legenda">
              Conteudo protegido por sigilo profissional. Nao sai em nenhum
              export destinado ao cliente.
            </p>
            {anotacoes.length === 0 ? (
              <p className="vazio">Nenhuma anotacao.</p>
            ) : (
              anotacoes.map((a) => (
                <div className="cartao" key={a.id}>
                  <div className="legenda" style={{ marginBottom: ".35rem" }}>
                    {a.autor.nome} — {a.criadoEm.toLocaleString("pt-BR")}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{a.conteudo}</div>
                </div>
              ))
            )}
          </>
        )}
      </main>
    </>
  );
}
