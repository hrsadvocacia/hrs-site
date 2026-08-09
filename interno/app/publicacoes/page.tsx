import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { formatarBR, somarDias, type DataISO } from "@/lib/prazos/dias";
import { pendenciasDeCaptura, resumirPendencias } from "@/lib/publicacoes/vigilancia";
import { FormularioManual, BotaoConfirmarSemPublicacoes } from "./formularios";

export const metadata = { title: "Publicações — HRS Interno" };

const STATUS: Record<string, string> = {
  PENDENTE_TRIAGEM: "Pendente de triagem",
  VINCULADA: "Vinculada",
  ORFA: "Órfã",
  SUSPEITA_HOMONIMO: "Suspeita de homônimo",
  DESCARTADA: "Descartada",
};

const SITUACAO: Record<string, string> = {
  SEM_REGISTRO: "Nenhuma captura iniciada",
  NAO_CONCLUIDA: "Captura interrompida",
  FALHA: "Falha na consulta",
  AGUARDA_CONFIRMACAO: "Aguarda confirmação humana",
};

export default async function Publicacoes() {
  const usuario = await exigirPermissao("publicacao", "ler");
  const hoje = new Date().toISOString().slice(0, 10) as DataISO;
  const de = somarDias(hoje, -14);

  const [naFila, inscricoes, batimentos] = await Promise.all([
    prisma.publicacao.findMany({
      where: { status: { in: ["PENDENTE_TRIAGEM", "ORFA", "SUSPEITA_HOMONIMO"] } },
      orderBy: { dataDisponibilizacao: "desc" },
      take: 100,
      select: {
        id: true, fonte: true, dataDisponibilizacao: true, teor: true,
        numeroProcessoDigitos: true, status: true, suspeitaHomonimo: true,
        nomeAdvogadoCitado: true,
      },
    }),
    prisma.inscricaoOab.findMany({
      where: { monitorada: true, ativa: true },
      select: { id: true, numero: true, uf: true, usuario: { select: { nome: true } } },
    }),
    prisma.capturaDiaria.findMany({
      where: { data: { gte: new Date(`${de}T00:00:00Z`) } },
      select: {
        id: true, data: true, inscricaoOabId: true, status: true,
        confirmadaPorId: true, mensagemErro: true,
      },
    }),
  ]);

  const pendencias = pendenciasDeCaptura({
    inscricoesMonitoradas: inscricoes.map((i) => i.id),
    batimentos: batimentos.map((b) => ({
      data: b.data.toISOString().slice(0, 10),
      inscricaoOabId: b.inscricaoOabId,
      status: b.status,
      confirmadaPorId: b.confirmadaPorId,
    })),
    de,
    ate: hoje,
  });

  const resumo = resumirPendencias(pendencias);

  const nomeInscricao = new Map(
    inscricoes.map((i) => [i.id, `${i.usuario.nome} — OAB ${i.numero}/${i.uf}`]),
  );
  const idPorChave = new Map(
    batimentos.map((b) => [`${b.data.toISOString().slice(0, 10)}|${b.inscricaoOabId}`, b.id]),
  );

  const suspeitas = naFila.filter((p) => p.status === "SUSPEITA_HOMONIMO");
  const orfas = naFila.filter((p) => p.status !== "SUSPEITA_HOMONIMO");

  const Linha = ({ p }: { p: (typeof naFila)[number] }) => (
    <tr>
      <td style={{ whiteSpace: "nowrap" }}>
        <Link href={`/publicacoes/${p.id}`}>
          {formatarBR(p.dataDisponibilizacao.toISOString().slice(0, 10))}
        </Link>
      </td>
      <td>{p.fonte}</td>
      <td>{p.numeroProcessoDigitos ?? <em>sem número identificado</em>}</td>
      <td>{p.teor.slice(0, 120)}{p.teor.length > 120 ? "…" : ""}</td>
      <td>{STATUS[p.status]}</td>
    </tr>
  );

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Publicações</h1>
        <p className="legenda">
          Fila de triagem e vigilância da captura diária.
        </p>

        <div className="aviso aviso-atencao">
          <strong>A captura automática do DJEN ainda não está ligada.</strong> O
          adaptador existe, mas o contrato de resposta da API não foi verificado
          contra uma chamada real — e escrever o mapeamento por suposição
          produziria um sistema que não casa nenhum processo sem acusar erro. Até
          lá, publicação entra por lançamento manual, abaixo.
        </div>

        {/* Ausência primeiro. Um dia sem captura não gera log de erro nenhum:
            só aparece comparando o esperado com o observado. */}
        {resumo.length > 0 && (
          <>
            <p className="aviso aviso-erro">
              <strong>A captura diária não está concluindo.</strong> Dia sem
              captura confirmada é dia em que pode ter havido intimação sem
              ninguém ver.
            </p>
            <div className="rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Inscrição</th><th>Situação</th><th>Dias úteis</th>
                    <th>Período</th><th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.map((r) => (
                    <tr key={`${r.inscricaoOabId}-${r.situacao}`}>
                      <td>{nomeInscricao.get(r.inscricaoOabId) ?? r.inscricaoOabId}</td>
                      <td>
                        <span className="etiqueta etiqueta-alerta">
                          {SITUACAO[r.situacao]}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.dias}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {r.desde === r.ate
                          ? formatarBR(r.desde)
                          : `${formatarBR(r.desde)} a ${formatarBR(r.ate)}`}
                      </td>
                      <td>{r.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Confirmação de "não houve publicação" é ato por dia: fica
                separada, e só aparece quando há dia esperando alguém dizer. */}
            {pendencias.some((p) => p.situacao === "AGUARDA_CONFIRMACAO") && (
              <>
                <h2>Dias sem publicação aguardando confirmação</h2>
                <div className="rolagem">
                  <table>
                    <thead>
                      <tr><th>Dia</th><th>Inscrição</th><th></th></tr>
                    </thead>
                    <tbody>
                      {pendencias
                        .filter((p) => p.situacao === "AGUARDA_CONFIRMACAO")
                        .map((p) => {
                          const capturaId = idPorChave.get(`${p.data}|${p.inscricaoOabId}`);
                          return (
                            <tr key={`${p.data}-${p.inscricaoOabId}`}>
                              <td style={{ whiteSpace: "nowrap" }}>{formatarBR(p.data)}</td>
                              <td>{nomeInscricao.get(p.inscricaoOabId) ?? p.inscricaoOabId}</td>
                              <td>
                                {capturaId && (
                                  <BotaoConfirmarSemPublicacoes capturaId={capturaId} />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {suspeitas.length > 0 && (
          <>
            <h2>Suspeitas de homônimo</h2>
            <p className="legenda">
              O nome do advogado confere, a OAB não. Pode ser outro profissional
              de mesmo nome — vincular sem conferir criaria prazo num caso que
              não é do escritório.
            </p>
            <div className="rolagem">
              <table>
                <thead>
                  <tr><th>Disponibilização</th><th>Fonte</th><th>Processo</th><th>Teor</th><th>Situação</th></tr>
                </thead>
                <tbody>{suspeitas.map((p) => <Linha key={p.id} p={p} />)}</tbody>
              </table>
            </div>
          </>
        )}

        <h2>Fila de triagem</h2>
        {orfas.length === 0 ? (
          <p className="vazio">
            Nenhuma publicação aguardando triagem.
          </p>
        ) : (
          <div className="rolagem">
            <table>
              <thead>
                <tr><th>Disponibilização</th><th>Fonte</th><th>Processo</th><th>Teor</th><th>Situação</th></tr>
              </thead>
              <tbody>{orfas.map((p) => <Linha key={p.id} p={p} />)}</tbody>
            </table>
          </div>
        )}

        <h2>Lançar publicação manualmente</h2>
        <p className="legenda">
          Para comunicação recebida por outro caminho, conferência do DEJT ou
          intimação pessoal. Passa pela mesma triagem e pela mesma deduplicação.
        </p>
        <FormularioManual />
      </main>
    </>
  );
}
