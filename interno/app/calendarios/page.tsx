import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Calendários — HRS Interno" };

const STATUS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  VIGENTE: "Vigente",
  SUBSTITUIDO: "Substituído",
};

export default async function Calendarios() {
  const usuario = await exigirPermissao("calendario", "ler");

  const calendarios = await prisma.calendarioTribunal.findMany({
    orderBy: [{ ano: "asc" }, { tribunal: { codigo: "asc" } }, { versao: "desc" }],
    select: {
      id: true,
      ano: true,
      versao: true,
      status: true,
      tribunal: { select: { sigla: true, nome: true } },
      _count: { select: { dias: true } },
    },
  });

  const rascunhos = calendarios.filter((c) => c.status === "RASCUNHO").length;

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Calendários forenses</h1>
        <p className="legenda">
          Um calendário por tribunal e por ano, versionado. Só o vigente é usado
          no cálculo de prazos.
        </p>

        {rascunhos > 0 && (
          <p className="aviso aviso-atencao">
            <strong>{rascunhos} calendário(s) ainda em rascunho.</strong> Enquanto
            as suspensões de expediente por portaria não forem lançadas e o
            calendário não for aprovado, o cálculo de prazos daquele tribunal é
            recusado — de propósito. Data calculada sobre calendário não conferido
            é número com aparência de fundamento.
          </p>
        )}

        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th>Tribunal</th>
                <th>Ano</th>
                <th>Versão</th>
                <th>Lançamentos</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {calendarios.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/calendarios/${c.id}`}>{c.tribunal.sigla}</Link>
                  </td>
                  <td>{c.ano}</td>
                  <td>v{c.versao}</td>
                  <td>{c._count.dias}</td>
                  <td>
                    <span
                      className={
                        c.status === "VIGENTE"
                          ? "etiqueta"
                          : c.status === "RASCUNHO"
                            ? "etiqueta etiqueta-pendente"
                            : "etiqueta"
                      }
                    >
                      {STATUS[c.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
