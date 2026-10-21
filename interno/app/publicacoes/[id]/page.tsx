import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { registrar } from "@/lib/auditoria";
import { formatarBR } from "@/lib/prazos/dias";
import { FormularioVincular, FormularioDescartar } from "../formularios";

export const metadata = { title: "Publicação — HRS Interno" };

const STATUS: Record<string, string> = {
  PENDENTE_TRIAGEM: "Pendente de triagem",
  VINCULADA: "Vinculada",
  ORFA: "Órfã",
  SUSPEITA_HOMONIMO: "Suspeita de homônimo",
  DESCARTADA: "Descartada",
};

export default async function DetalhePublicacao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await exigirPermissao("publicacao", "ler");
  const { id } = await params;

  const publicacao = await prisma.publicacao.findUnique({
    where: { id },
    include: {
      processo: { select: { id: true, numeroCnj: true } },
      triadaPor: { select: { nome: true } },
      inscricaoOab: { select: { numero: true, uf: true, usuario: { select: { nome: true } } } },
    },
  });
  if (!publicacao) notFound();

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "LEITURA",
    entidade: "publicacao",
    entidadeId: publicacao.id,
    descricao: "Publicação consultada na triagem",
  });

  const processos = await prisma.processo.findMany({
    where: { situacao: { in: ["EM_ANDAMENTO", "EM_EXECUCAO", "SUSPENSO"] } },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true, numeroCnj: true, numeroCnjDigitos: true,
      partes: { where: { tipo: "CLIENTE" }, take: 1, select: { nome: true } },
    },
  });

  // Se a publicação traz CNJ válido, o processo correspondente já vem
  // pré-selecionado — poupa o advogado de procurar o que o sistema já sabe.
  const sugerido =
    processos.find((p) => p.numeroCnjDigitos === publicacao.numeroProcessoDigitos)?.id ?? null;

  const emTriagem = ["PENDENTE_TRIAGEM", "ORFA", "SUSPEITA_HOMONIMO"].includes(
    publicacao.status,
  );

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Comunicação de {formatarBR(publicacao.dataDisponibilizacao.toISOString().slice(0, 10))}</h1>
        <p className="legenda">
          {publicacao.fonte} &middot; {STATUS[publicacao.status]}
          {publicacao.processo && (
            <>
              {" "}&middot;{" "}
              <Link href={`/processos/${publicacao.processo.id}`}>
                {publicacao.processo.numeroCnj}
              </Link>
            </>
          )}
        </p>

        {publicacao.suspeitaHomonimo && (
          <p className="aviso aviso-erro">
            <strong>Suspeita de homônimo.</strong> O nome citado
            {publicacao.nomeAdvogadoCitado ? ` (${publicacao.nomeAdvogadoCitado})` : ""}{" "}
            confere com alguém do escritório, mas a OAB indicada na comunicação
            não corresponde a nenhuma inscrição cadastrada. Confira antes de
            vincular: um prazo criado num caso que não é nosso é tão ruim quanto
            um prazo perdido.
          </p>
        )}

        {publicacao.status === "ORFA" && (
          <p className="aviso aviso-atencao">
            <strong>Órfã.</strong> Não foi possível casar automaticamente com
            processo cadastrado. Nada é descartado por isso — a comunicação
            aguarda decisão humana.
          </p>
        )}

        <h2>Teor</h2>
        <div className="cartao">
          <div style={{ whiteSpace: "pre-wrap" }}>{publicacao.teor}</div>
        </div>

        <h2>Procedência</h2>
        <div className="cartao">
          <div className="linha">
            <div>
              <strong>Disponibilização</strong>
              <div>{formatarBR(publicacao.dataDisponibilizacao.toISOString().slice(0, 10))}</div>
            </div>
            <div>
              <strong>Número identificado</strong>
              <div>{publicacao.numeroProcessoDigitos ?? "—"}</div>
            </div>
            <div>
              <strong>Inscrição da captura</strong>
              <div>
                {publicacao.inscricaoOab
                  ? `${publicacao.inscricaoOab.usuario.nome} — OAB ${publicacao.inscricaoOab.numero}/${publicacao.inscricaoOab.uf}`
                  : "Lançamento manual"}
              </div>
            </div>
            <div>
              <strong>Certidão</strong>
              <div>
                {publicacao.urlCertidao ? (
                  <a href={publicacao.urlCertidao} target="_blank" rel="noopener">
                    abrir certidão
                  </a>
                ) : "—"}
              </div>
            </div>
          </div>
          {publicacao.triadaPor && (
            <p className="legenda" style={{ margin: ".8rem 0 0" }}>
              Triada por {publicacao.triadaPor.nome} em{" "}
              {publicacao.triadaEm?.toLocaleString("pt-BR")}.
            </p>
          )}
          {publicacao.justificativaDescarte && (
            <p style={{ marginBottom: 0 }}>
              <strong>Motivo do descarte:</strong> {publicacao.justificativaDescarte}
            </p>
          )}
        </div>

        <h2>Resposta original da fonte</h2>
        <p className="legenda">
          Guardada sem tradução. É o que permite reconstituir exatamente o que a
          fonte disse — inclusive se o adaptador estiver errado.
        </p>
        <div className="cartao">
          <pre style={{ margin: 0, overflowX: "auto", fontSize: ".8rem" }}>
            {JSON.stringify(publicacao.payloadBruto, null, 2)}
          </pre>
        </div>

        {emTriagem && pode(usuario.perfil, "publicacao", "editar") && (
          <>
            <h2>Triagem</h2>
            <FormularioVincular
              publicacaoId={publicacao.id}
              sugerido={sugerido}
              processos={processos.map((p) => ({
                id: p.id,
                rotulo: `${p.numeroCnj}${p.partes[0] ? ` — ${p.partes[0].nome}` : ""}`,
              }))}
            />
            <div style={{ marginTop: "1rem" }}>
              <FormularioDescartar publicacaoId={publicacao.id} />
            </div>
          </>
        )}
      </main>
    </>
  );
}
