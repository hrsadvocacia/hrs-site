import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { podeConfirmarPrazo, pode } from "@/lib/rbac";
import { registrar } from "@/lib/auditoria";
import { formatarBR, type DataISO } from "@/lib/prazos/dias";
import { severidade } from "@/lib/prazos/alertas";
import {
  cancelarPrazo,
  confirmarPrazo,
  cumprirPrazo,
  registrarTratativa,
} from "../acoes";

export const metadata = { title: "Prazo — HRS Interno" };

const STATUS: Record<string, string> = {
  PENDENTE_CONFERENCIA: "Pendente de conferência",
  CONFIRMADO: "Confirmado",
  EM_TRATATIVA: "Em tratativa",
  CUMPRIDO: "Cumprido",
  PERDIDO: "Perdido",
  PREJUDICADO: "Prejudicado",
  CANCELADO: "Cancelado",
};

const REGIME: Record<string, string> = {
  DIAS_UTEIS_TRABALHISTA: "Dias úteis — trabalhista",
  DIAS_UTEIS_CPC: "Dias úteis — processo civil",
  DIAS_CORRIDOS_PENAL: "Dias corridos — penal",
  DIAS_CORRIDOS: "Dias corridos — material/administrativo",
};

const ORIGEM_FERIADO: Record<string, string> = {
  NACIONAL: "Feriado nacional",
  ESTADUAL: "Feriado estadual",
  MUNICIPAL: "Feriado municipal",
  TRIBUNAL: "Ato do tribunal",
  RECESSO: "Recesso forense",
};

function iso(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

export default async function FichaPrazo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await exigirPermissao("prazo", "ler");
  const { id } = await params;

  const prazo = await prisma.prazo.findUnique({
    where: { id },
    include: {
      processo: { select: { id: true, numeroCnj: true } },
      tribunal: { select: { sigla: true, nome: true } },
      responsavel: { select: { nome: true } },
      confirmadoPor: { select: { nome: true } },
      cumpridoPor: { select: { nome: true } },
      canceladoPor: { select: { nome: true } },
      tratativas: {
        orderBy: { criadoEm: "desc" },
        include: { usuario: { select: { nome: true } } },
      },
    },
  });
  if (!prazo) notFound();

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "LEITURA",
    entidade: "prazo",
    entidadeId: prazo.id,
    descricao: "Ficha de prazo consultada",
  });

  const hoje = iso(new Date());
  const grau = severidade(
    { dataFatal: iso(prazo.dataFatal), status: prazo.status },
    hoje,
  );
  const feriados = (prazo.feriadosAplicados ?? []) as Array<{
    data: string; nome: string; origem: string; fonte: string;
  }>;
  const premissas = (prazo.premissas ?? []) as string[];

  const podeConfirmar =
    prazo.status === "PENDENTE_CONFERENCIA" && podeConfirmarPrazo(usuario.perfil);
  const emCurso = ["PENDENTE_CONFERENCIA", "CONFIRMADO", "EM_TRATATIVA"].includes(
    prazo.status,
  );

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>{prazo.titulo}</h1>
        <p className="legenda">
          <Link href={`/processos/${prazo.processo.id}`}>{prazo.processo.numeroCnj}</Link>{" "}
          &middot; {prazo.tribunal.sigla} &middot; Responsável: {prazo.responsavel.nome}
        </p>

        {prazo.status === "PENDENTE_CONFERENCIA" && (
          <p className="aviso aviso-atencao">
            <strong>Pendente de conferência.</strong> Este prazo ainda não foi
            confirmado por advogado. Enquanto não for, não é prazo controlado —
            confira os insumos abaixo antes de confirmar.
          </p>
        )}
        {grau === "vencido" && emCurso && (
          <p className="aviso aviso-erro">
            <strong>Data fatal ultrapassada sem baixa registrada.</strong> O
            sistema não encerra prazo sozinho: registre o cumprimento ou o
            cancelamento com justificativa.
          </p>
        )}

        {/* A data NUNCA aparece sozinha: os insumos vêm junto, sempre. */}
        <div className="cartao" style={{ borderTopWidth: 3, borderTopStyle: "solid", borderTopColor: grau === "vencido" || grau === "hoje" || grau === "critico" ? "var(--alerta)" : "var(--ouro-medio)" }}>
          <div className="rotulo">Data fatal</div>
          <div style={{ fontSize: "2.1rem", fontWeight: 600, color: "var(--azul-escuro)" }}>
            {formatarBR(iso(prazo.dataFatal))}
          </div>
          <div className="legenda" style={{ margin: ".35rem 0 0" }}>
            {STATUS[prazo.status]} &middot; {prazo.diasUteisContados} dias
            contados &middot; {REGIME[prazo.regimeContagem]}
          </div>
        </div>

        <h2>Insumos do cálculo</h2>
        <div className="cartao">
          <div className="linha">
            <div>
              <strong>Disponibilização no diário</strong>
              <div>{prazo.dataDisponibilizacao ? formatarBR(iso(prazo.dataDisponibilizacao)) : "—"}</div>
            </div>
            <div>
              <strong>Publicação considerada</strong>
              <div>{formatarBR(iso(prazo.dataPublicacaoConsiderada))}</div>
            </div>
            <div>
              <strong>Início da contagem</strong>
              <div>{formatarBR(iso(prazo.dataInicioContagem))}</div>
            </div>
            <div>
              <strong>Prazo</strong>
              <div>{prazo.prazoDias} dias</div>
            </div>
          </div>
        </div>

        <h2>Premissas assumidas</h2>
        <div className="cartao">
          <ol style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {premissas.map((p, i) => (
              <li key={i} style={{ marginBottom: ".35rem" }}>{p}</li>
            ))}
          </ol>
        </div>

        <h2>Feriados e suspensões aplicados</h2>
        {feriados.length === 0 ? (
          <p className="vazio">
            Nenhum feriado ou suspensão incidiu sobre a contagem.
          </p>
        ) : (
          <div className="rolagem">
            <table>
              <thead>
                <tr><th>Data</th><th>Ocorrência</th><th>Natureza</th><th>Fonte</th></tr>
              </thead>
              <tbody>
                {feriados.map((f) => (
                  <tr key={`${f.data}-${f.nome}`}>
                    <td>{formatarBR(f.data)}</td>
                    <td>{f.nome}</td>
                    <td>{ORIGEM_FERIADO[f.origem] ?? f.origem}</td>
                    <td>{f.fonte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Fundamento legal</h2>
        <div className="cartao">
          <p style={{ margin: 0 }}>{prazo.fundamentoLegal}</p>
          <p className="legenda" style={{ margin: ".6rem 0 0", fontSize: ".82rem" }}>
            Calculado em {prazo.calculadoEm.toLocaleString("pt-BR")} pelo{" "}
            {prazo.versaoMotor}.
          </p>
        </div>

        <h2>Responsabilidade</h2>
        <div className="cartao">
          <div className="linha">
            <div>
              <strong>Confirmado por</strong>
              <div>
                {prazo.confirmadoPor
                  ? `${prazo.confirmadoPor.nome} em ${prazo.confirmadoEm!.toLocaleString("pt-BR")}`
                  : "Ainda não confirmado"}
              </div>
            </div>
            {prazo.cumpridoPor && (
              <div>
                <strong>Cumprido por</strong>
                <div>{prazo.cumpridoPor.nome} em {prazo.cumpridoEm!.toLocaleString("pt-BR")}</div>
              </div>
            )}
            {prazo.canceladoPor && (
              <div>
                <strong>Cancelado por</strong>
                <div>{prazo.canceladoPor.nome}</div>
              </div>
            )}
          </div>
          {prazo.justificativaCancelamento && (
            <p style={{ marginBottom: 0 }}>
              <strong>Justificativa:</strong> {prazo.justificativaCancelamento}
            </p>
          )}
        </div>

        {podeConfirmar && (
          <form
            action={async () => {
              "use server";
              await confirmarPrazo(id);
            }}
            className="acoes"
          >
            <button type="submit">Conferi os insumos — confirmar prazo</button>
          </form>
        )}

        {emCurso && pode(usuario.perfil, "prazo", "editar") && (
          <>
            <h2>Tratativas</h2>
            <p className="legenda">
              Registrar tratativa interrompe o escalonamento automático ao sócio,
              que ocorre a partir de D-3 sem providência anotada.
            </p>
            <form
              className="formulario"
              action={async (dados: FormData) => {
                "use server";
                await registrarTratativa(id, String(dados.get("descricao") ?? ""));
              }}
            >
              <label>
                <span>Providência adotada</span>
                <textarea name="descricao" required minLength={5} />
              </label>
              <div className="acoes">
                <button type="submit">Registrar tratativa</button>
              </div>
            </form>

            {prazo.tratativas.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                {prazo.tratativas.map((t) => (
                  <div className="cartao" key={t.id}>
                    <div className="legenda" style={{ marginBottom: ".3rem" }}>
                      {t.usuario.nome} &middot; {t.criadoEm.toLocaleString("pt-BR")}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{t.descricao}</div>
                  </div>
                ))}
              </div>
            )}

            <h2>Baixa do prazo</h2>
            <div className="acoes">
              <form
                action={async () => {
                  "use server";
                  await cumprirPrazo(id);
                }}
              >
                <button type="submit">Registrar cumprimento</button>
              </form>
            </div>

            {podeConfirmarPrazo(usuario.perfil) && (
              <form
                className="formulario"
                style={{ marginTop: "1rem" }}
                action={async (dados: FormData) => {
                  "use server";
                  await cancelarPrazo(id, String(dados.get("justificativa") ?? ""));
                }}
              >
                <label>
                  <span>Cancelar prazo</span>
                  <textarea
                    name="justificativa"
                    required
                    minLength={10}
                    placeholder="Motivo do cancelamento — publicação referente a outro processo, ato já praticado, etc."
                  />
                  <small>
                    Prazo não se apaga. O cancelamento fica registrado com autor,
                    data e motivo.
                  </small>
                </label>
                <div className="acoes">
                  <button type="submit" className="botao-secundario">
                    Cancelar prazo com justificativa
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </>
  );
}
