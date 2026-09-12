import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { formatarBR, somarDias, type DataISO } from "@/lib/prazos/dias";
import {
  domicilioEmAlerta,
  pendenciasDeDomicilio,
  ultimoDiaUtil,
} from "@/lib/publicacoes/vigilancia";
import { UNIDADE } from "@/lib/rotulos";
import { FormularioConferencia } from "./formulario";

export const metadata = { title: "Domicílio Judicial — HRS Interno" };

const UNIDADES = ["GOIANIA", "TERESINA", "TIMON"] as const;

export default async function Domicilio() {
  const usuario = await exigirPermissao("publicacao", "ler");
  const hoje = new Date().toISOString().slice(0, 10) as DataISO;
  const de = somarDias(hoje, -21);

  const registros = await prisma.checklistDomicilio.findMany({
    where: { data: { gte: new Date(`${de}T00:00:00Z`) } },
    orderBy: { data: "desc" },
    include: { confirmadoPor: { select: { nome: true } } },
  });

  const pendencias = pendenciasDeDomicilio({
    unidades: [...UNIDADES],
    confirmacoes: registros.map((r) => ({
      data: r.data.toISOString().slice(0, 10),
      unidade: r.unidade,
      confirmadoEm: r.confirmadoEm,
    })),
    de,
    ate: hoje,
  });

  const emAlerta = domicilioEmAlerta(pendencias);
  const porUnidade = UNIDADES.map((u) => ({
    unidade: u,
    atraso: Math.max(0, ...pendencias.filter((p) => p.unidade === u).map((p) => p.diasUteisDeAtraso)),
  }));

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Domicílio Judicial Eletrônico</h1>
        <p className="legenda">
          Conferência diária, por unidade. Registro de ato humano.
        </p>

        <div className="aviso aviso-atencao">
          <strong>Não há integração com o Domicílio — e não vai haver.</strong>{" "}
          Citações e intimações que exigem pessoalidade correm por lá e{" "}
          <strong>não aparecem no DJEN</strong>. Nenhuma captura automática deste
          sistema cobre esse canal. O que o sistema faz é tornar visível o dia em
          que ninguém conferiu.
        </div>

        {emAlerta && (
          <p className="aviso aviso-erro">
            <strong>Há unidade com mais de um dia útil sem conferência.</strong>{" "}
            Cada dia sem olhar o Domicílio é um dia em que uma citação pode ter
            chegado sem ninguém saber.
          </p>
        )}

        <h2>Situação por unidade</h2>
        <div className="grade">
          {porUnidade.map((u) => (
            <div className="indicador" key={u.unidade}
              style={u.atraso > 1 ? { borderTopColor: "var(--alerta)" } : undefined}>
              <div className="rotulo">{UNIDADE[u.unidade]}</div>
              <div className="numero" style={u.atraso > 1 ? { color: "var(--alerta)" } : undefined}>
                {u.atraso === 0 ? "Em dia" : `${u.atraso} d`}
              </div>
              {u.atraso > 0 && (
                <div className="legenda" style={{ margin: 0, fontSize: ".8rem" }}>
                  dia(s) útil(eis) sem conferência
                </div>
              )}
            </div>
          ))}
        </div>

        <h2>Registrar conferência</h2>
        <FormularioConferencia
          data={ultimoDiaUtil(hoje)}
          unidades={UNIDADES.map((u) => ({ valor: u, rotulo: UNIDADE[u]! }))}
          unidadePadrao={usuario.unidade}
        />

        <h2>Últimas conferências</h2>
        {registros.length === 0 ? (
          <p className="vazio">Nenhuma conferência registrada nos últimos 21 dias.</p>
        ) : (
          <div className="rolagem">
            <table>
              <thead>
                <tr><th>Dia</th><th>Unidade</th><th>Conferido por</th><th>Novidade</th><th>Observação</th></tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatarBR(r.data.toISOString().slice(0, 10))}
                    </td>
                    <td>{UNIDADE[r.unidade]}</td>
                    <td>{r.confirmadoPor?.nome ?? "—"}</td>
                    <td>
                      {r.houveNovidade ? (
                        <span className="etiqueta etiqueta-pendente">sim</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{r.observacao ?? "—"}</td>
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
