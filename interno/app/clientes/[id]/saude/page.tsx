import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { dataBR, dataHoraBR } from "@/lib/tempo";
import { CATEGORIA_DADO_SENSIVEL, rotulo } from "@/lib/rotulos";
import { FormularioDadoSensivel, RevelarDado } from "./formularios";

export const metadata = { title: "Dados de saúde — HRS Interno" };

export default async function DadosSaude({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPermissao("dadoSensivel", "ler");
  const { id } = await params;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: {
      id: true, nome: true,
      dadosSensiveis: {
        orderBy: { criadoEm: "desc" },
        include: {
          acessos: { orderBy: { ocorridoEm: "desc" }, take: 5, include: { usuario: { select: { nome: true } } } },
        },
      },
    },
  });
  if (!cliente) notFound();

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Dados de saúde — {cliente.nome}</h1>
        <p className="legenda">
          <Link href={`/clientes/${cliente.id}`}>← ficha do cliente</Link>
        </p>

        <div className="aviso aviso-atencao">
          <strong>Dado pessoal sensível (LGPD art. 11).</strong> Base legal: art. 11, II, &quot;d&quot; —
          exercício regular de direitos em processo judicial. O conteúdo é cifrado em repouso e{" "}
          <strong>cada leitura é registrada individualmente</strong>, com autor, data e finalidade declarada.
          Perfis Financeiro, Estagiário e Administração não têm acesso.
        </div>

        <h2>Registros ({cliente.dadosSensiveis.length})</h2>
        {cliente.dadosSensiveis.length === 0 ? (
          <p className="vazio">Nenhum registro de saúde cadastrado.</p>
        ) : (
          cliente.dadosSensiveis.map((d) => (
            <div key={d.id} style={{ marginBottom: "1.2rem" }}>
              <p className="legenda" style={{ marginBottom: ".3rem" }}>
                {rotulo(CATEGORIA_DADO_SENSIVEL, d.categoria)} · cadastrado em {dataBR(d.criadoEm)}
                {d.descartarApos && <> · descarte previsto em {dataBR(d.descartarApos)}</>}
                {d.anonimizadoEm && <> · <span className="etiqueta">anonimizado</span></>}
              </p>
              <RevelarDado dadoId={d.id} rotulo={d.rotulo} />
              {d.acessos.length > 0 && (
                <details style={{ marginTop: ".4rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--tinta-suave)" }}>
                    Últimas leituras ({d.acessos.length})
                  </summary>
                  <ul style={{ fontSize: ".85rem", color: "var(--tinta-suave)" }}>
                    {d.acessos.map((a) => (
                      <li key={a.id}>{dataHoraBR(a.ocorridoEm)} — {a.usuario.nome}{a.finalidade ? `: ${a.finalidade}` : ""}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))
        )}

        {pode(usuario.perfil, "dadoSensivel", "criar") && (
          <>
            <h2>Novo registro</h2>
            <FormularioDadoSensivel clienteId={cliente.id} />
          </>
        )}
      </main>
    </>
  );
}
