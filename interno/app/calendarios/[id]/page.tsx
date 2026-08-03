import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { formatarBR } from "@/lib/prazos/dias";
import { FormularioDia, BotaoAprovar } from "../formularios";

export const metadata = { title: "Calendário — HRS Interno" };

const TIPO: Record<string, string> = {
  FERIADO_FORENSE: "Feriado forense",
  SUSPENSAO_EXPEDIENTE: "Suspensão de expediente",
  PONTO_FACULTATIVO: "Ponto facultativo",
  RECESSO_FORENSE: "Recesso forense",
  SUSPENSAO_PRAZOS: "Suspensão de prazos",
};

export default async function DetalheCalendario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await exigirPermissao("calendario", "ler");
  const { id } = await params;

  const calendario = await prisma.calendarioTribunal.findUnique({
    where: { id },
    include: {
      tribunal: { select: { id: true, sigla: true, nome: true } },
      revisadoPor: { select: { nome: true } },
      dias: {
        orderBy: { data: "asc" },
        include: { orgaoJulgador: { select: { nome: true, municipio: true } } },
      },
    },
  });
  if (!calendario) notFound();

  const orgaos = await prisma.orgaoJulgador.findMany({
    where: { tribunalId: calendario.tribunal.id },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, municipio: true },
  });

  const editavel =
    calendario.status === "RASCUNHO" && pode(usuario.perfil, "calendario", "editar");

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>
          {calendario.tribunal.sigla} — {calendario.ano}
        </h1>
        <p className="legenda">
          {calendario.tribunal.nome} &middot; versão {calendario.versao} &middot;{" "}
          {calendario.status === "VIGENTE"
            ? `vigente desde ${calendario.vigenteDesde?.toLocaleDateString("pt-BR")}`
            : calendario.status === "RASCUNHO"
              ? "em rascunho"
              : "substituído"}
        </p>

        {calendario.status === "RASCUNHO" && (
          <p className="aviso aviso-atencao">
            <strong>Rascunho.</strong> O cálculo de prazos deste tribunal está
            recusado até a aprovação. Lance as suspensões de expediente por
            portaria e os feriados estaduais e municipais da praça antes de
            aprovar.
          </p>
        )}
        {calendario.status === "SUBSTITUIDO" && (
          <p className="aviso aviso-atencao">
            Versão substituída. Mantida no sistema porque prazos já calculados
            apontam para ela e precisam continuar reconstituíveis.
          </p>
        )}

        <h2>Dias sem expediente lançados</h2>
        {calendario.dias.length === 0 ? (
          <p className="vazio">
            Nenhum lançamento. Feriados nacionais de lei federal já entram pelo
            cadastro geral e não precisam ser repetidos aqui.
          </p>
        ) : (
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th>Data</th><th>Ocorrência</th><th>Tipo</th>
                  <th>Suspende?</th><th>Alcance</th><th>Fonte</th>
                </tr>
              </thead>
              <tbody>
                {calendario.dias.map((d) => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatarBR(d.data.toISOString().slice(0, 10))}
                    </td>
                    <td>{d.descricao}</td>
                    <td>{TIPO[d.tipo]}</td>
                    <td>
                      {d.suspendeExpediente ? (
                        <span className="etiqueta etiqueta-alerta">sim</span>
                      ) : (
                        <span className="etiqueta">não conta</span>
                      )}
                    </td>
                    <td>
                      {d.orgaoJulgador
                        ? `${d.orgaoJulgador.nome} (${d.orgaoJulgador.municipio})`
                        : "Todo o tribunal"}
                    </td>
                    <td>{d.fonte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editavel && (
          <>
            <h2>Lançar dia sem expediente</h2>
            <FormularioDia
              calendarioId={calendario.id}
              orgaos={orgaos.map((o) => ({
                id: o.id,
                rotulo: `${o.nome} (${o.municipio})`,
              }))}
            />

            <h2>Aprovar calendário</h2>
            <p className="legenda">
              A aprovação libera o cálculo de prazos deste tribunal e fica
              carimbada com seu nome.
            </p>
            <BotaoAprovar calendarioId={calendario.id} />
          </>
        )}

        {calendario.revisadoPor && (
          <p className="legenda" style={{ marginTop: "1.5rem" }}>
            Revisado por {calendario.revisadoPor.nome} em{" "}
            {calendario.revisadoEm?.toLocaleString("pt-BR")}.
          </p>
        )}
      </main>
    </>
  );
}
