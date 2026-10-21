import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { diferencaEmDias, formatarBR, type DataISO } from "@/lib/prazos/dias";
import { severidade, type Severidade } from "@/lib/prazos/alertas";

export const metadata = { title: "Prazos — HRS Interno" };

const STATUS: Record<string, string> = {
  PENDENTE_CONFERENCIA: "Pendente de conferência",
  CONFIRMADO: "Confirmado",
  EM_TRATATIVA: "Em tratativa",
  CUMPRIDO: "Cumprido",
  PERDIDO: "Perdido",
  PREJUDICADO: "Prejudicado",
  CANCELADO: "Cancelado",
};

const CLASSE: Record<Severidade, string> = {
  vencido: "etiqueta etiqueta-alerta",
  hoje: "etiqueta etiqueta-alerta",
  critico: "etiqueta etiqueta-alerta",
  atencao: "etiqueta etiqueta-pendente",
  normal: "etiqueta",
};

function iso(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

function restante(dias: number): string {
  if (dias < 0) return `vencido há ${Math.abs(dias)} d`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "falta 1 dia";
  return `faltam ${dias} dias`;
}

export default async function Prazos({
  searchParams,
}: {
  searchParams: Promise<{ meus?: string }>;
}) {
  const usuario = await exigirPermissao("prazo", "ler");
  const { meus } = await searchParams;
  const hoje = iso(new Date());

  const prazos = await prisma.prazo.findMany({
    where: {
      status: { in: ["PENDENTE_CONFERENCIA", "CONFIRMADO", "EM_TRATATIVA"] },
      ...(meus === "1" ? { responsavelId: usuario.id } : {}),
    },
    orderBy: { dataFatal: "asc" },
    select: {
      id: true,
      titulo: true,
      dataFatal: true,
      status: true,
      responsavel: { select: { nome: true } },
      processo: { select: { numeroCnj: true } },
      _count: { select: { tratativas: true } },
    },
  });

  const comGrau = prazos.map((p) => ({
    ...p,
    dias: diferencaEmDias(hoje, iso(p.dataFatal)),
    grau: severidade({ dataFatal: iso(p.dataFatal), status: p.status }, hoje),
  }));

  const vencidos = comGrau.filter((p) => p.grau === "vencido");
  const pendentes = comGrau.filter((p) => p.status === "PENDENTE_CONFERENCIA");
  const semTratativa = comGrau.filter(
    (p) => p.dias >= 0 && p.dias <= 3 && p._count.tratativas === 0,
  );

  const Tabela = ({ lista }: { lista: typeof comGrau }) => (
    <div className="rolagem">
      <table>
        <thead>
          <tr>
            <th>Data fatal</th>
            <th>Ato</th>
            <th>Processo</th>
            <th>Responsável</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.id}>
              <td style={{ whiteSpace: "nowrap" }}>
                <Link href={`/prazos/${p.id}`}>{formatarBR(iso(p.dataFatal))}</Link>
                <div>
                  <span className={CLASSE[p.grau]}>{restante(p.dias)}</span>
                </div>
              </td>
              <td>{p.titulo}</td>
              <td style={{ whiteSpace: "nowrap" }}>{p.processo.numeroCnj}</td>
              <td>{p.responsavel.nome}</td>
              <td>{STATUS[p.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Prazos</h1>
        <p className="legenda">
          {comGrau.length} prazo(s) em curso
          {meus === "1" ? " sob sua responsabilidade" : " no escritório"}.
        </p>

        <form className="acoes" style={{ marginTop: 0, marginBottom: "1.25rem" }}>
          <label style={{ display: "flex", gap: ".4rem", alignItems: "center", margin: 0 }}>
            <input type="checkbox" name="meus" value="1" defaultChecked={meus === "1"} style={{ width: "auto" }} />
            <span style={{ margin: 0 }}>Somente os meus</span>
          </label>
          <button type="submit" className="botao-secundario">Filtrar</button>
          {pode(usuario.perfil, "prazo", "criar") && (
            <Link className="botao" href="/prazos/novo">Novo prazo</Link>
          )}
        </form>

        {/*
          O que exige ação humana vem primeiro e não se mistura com a rotina.
          Um prazo vencido sem baixa no meio da lista geral passa despercebido.
        */}
        {vencidos.length > 0 && (
          <>
            <p className="aviso aviso-erro">
              <strong>{vencidos.length} prazo(s) com data ultrapassada e sem baixa.</strong>{" "}
              O sistema não encerra prazo sozinho — cada um precisa de cumprimento
              registrado ou cancelamento com justificativa.
            </p>
            <Tabela lista={vencidos} />
          </>
        )}

        {pendentes.length > 0 && (
          <>
            <h2>Pendentes de conferência</h2>
            <p className="legenda">
              Prazo não conferido não é prazo controlado. Precisa de ato nominal
              de advogado.
            </p>
            <Tabela lista={pendentes} />
          </>
        )}

        {semTratativa.length > 0 && (
          <>
            <h2>Críticos sem tratativa registrada</h2>
            <p className="legenda">
              A três dias ou menos do vencimento, sem providência anotada. Estes
              escalam para o sócio.
            </p>
            <Tabela lista={semTratativa} />
          </>
        )}

        <h2>Todos os prazos em curso</h2>
        {comGrau.length === 0 ? (
          <p className="vazio">
            Nenhum prazo em curso cadastrado. Isso não significa que não exista
            prazo correndo — a captura automática entra na Fase 2.
          </p>
        ) : (
          <Tabela lista={comGrau} />
        )}
      </main>
    </>
  );
}
