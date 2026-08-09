import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resumirPendencias,
  ultimoDiaUtil,
  diasUteisNoIntervalo,
  domicilioEmAlerta,
  pendenciasDeCaptura,
  pendenciasDeDomicilio,
  type BatimentoObservado,
} from "./vigilancia.ts";

// Semana de referência: 02/03/2026 é segunda-feira.
const SEG = "2026-03-02";
const TER = "2026-03-03";
const QUA = "2026-03-04";
const QUI = "2026-03-05";
const SEX = "2026-03-06";
const OAB = "insc-1";

function batimento(over: Partial<BatimentoObservado> = {}): BatimentoObservado {
  return {
    data: SEG,
    inscricaoOabId: OAB,
    status: "CONCLUIDA",
    confirmadaPorId: null,
    ...over,
  };
}

describe("dias úteis do intervalo", () => {
  it("exclui sábado e domingo", () => {
    assert.deepEqual(diasUteisNoIntervalo(SEG, "2026-03-09"), [
      SEG, TER, QUA, QUI, SEX, "2026-03-09",
    ]);
  });

  it("inclui as duas bordas", () => {
    assert.deepEqual(diasUteisNoIntervalo(SEG, SEG), [SEG]);
  });

  it("intervalo só de fim de semana vem vazio", () => {
    assert.deepEqual(diasUteisNoIntervalo("2026-03-07", "2026-03-08"), []);
  });
});

describe("o dia em que o job NÃO rodou é detectado", () => {
  it("ausência de registro vira pendência — este é o caso perigoso", () => {
    // Um cron que parou de disparar não escreve log de erro nenhum. Só
    // comparando o esperado com o observado a ausência aparece.
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: [OAB],
      batimentos: [batimento({ data: SEG })],
      de: SEG,
      ate: TER,
    });
    assert.equal(p.length, 1);
    assert.equal(p[0]!.data, TER);
    assert.equal(p[0]!.situacao, "SEM_REGISTRO");
    assert.match(p[0]!.motivo, /não gera log de erro/);
  });

  it("dia inteiro sem nenhuma captura acusa todas as inscrições", () => {
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: ["a", "b", "c"],
      batimentos: [],
      de: SEG,
      ate: SEG,
    });
    assert.equal(p.length, 3);
    assert.ok(p.every((x) => x.situacao === "SEM_REGISTRO"));
  });

  it("fim de semana não é cobrado", () => {
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: [OAB],
      batimentos: [],
      de: "2026-03-07",
      ate: "2026-03-08",
    });
    assert.deepEqual(p, []);
  });
});

describe("estados que exigem gente", () => {
  it("FALHA aparece", () => {
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: [OAB],
      batimentos: [batimento({ status: "FALHA" })],
      de: SEG,
      ate: SEG,
    });
    assert.equal(p[0]!.situacao, "FALHA");
  });

  it("captura presa em PENDENTE ou EM_EXECUCAO aparece", () => {
    for (const status of ["PENDENTE", "EM_EXECUCAO"] as const) {
      const p = pendenciasDeCaptura({
        inscricoesMonitoradas: [OAB],
        batimentos: [batimento({ status })],
        de: SEG,
        ate: SEG,
      });
      assert.equal(p[0]!.situacao, "NAO_CONCLUIDA", status);
    }
  });

  it('"sem publicações" pende até alguém confirmar', () => {
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: [OAB],
      batimentos: [batimento({ status: "CONCLUIDA_SEM_PUBLICACOES" })],
      de: SEG,
      ate: SEG,
    });
    assert.equal(p[0]!.situacao, "AGUARDA_CONFIRMACAO");
    assert.match(p[0]!.motivo, /afirmação/);
  });

  it("confirmada por gente, sai da lista", () => {
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: [OAB],
      batimentos: [
        batimento({ status: "CONCLUIDA_SEM_PUBLICACOES", confirmadaPorId: "u1" }),
      ],
      de: SEG,
      ate: SEG,
    });
    assert.deepEqual(p, []);
  });

  it("captura concluída com publicações não pende", () => {
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: [OAB],
      batimentos: [batimento({ status: "CONCLUIDA" })],
      de: SEG,
      ate: SEG,
    });
    assert.deepEqual(p, []);
  });
});

describe("Domicílio Judicial Eletrônico — lacuna assumida", () => {
  const UNIDADES = ["GOIANIA", "TERESINA"];

  it("conta o atraso a partir do dia mais recente", () => {
    const p = pendenciasDeDomicilio({
      unidades: ["GOIANIA"],
      confirmacoes: [{ data: TER, unidade: "GOIANIA", confirmadoEm: new Date() }],
      de: SEG,
      ate: QUI,
    });
    // QUI e QUA sem confirmação; a contagem para em TER, que foi conferida.
    assert.deepEqual(
      p.map((x) => [x.data, x.diasUteisDeAtraso]),
      [[QUI, 1], [QUA, 2]],
    );
  });

  it("unidade em dia não gera pendência", () => {
    const p = pendenciasDeDomicilio({
      unidades: ["GOIANIA"],
      confirmacoes: [{ data: QUI, unidade: "GOIANIA", confirmadoEm: new Date() }],
      de: SEG,
      ate: QUI,
    });
    assert.deepEqual(p, []);
  });

  it("cada unidade é cobrada separadamente", () => {
    const p = pendenciasDeDomicilio({
      unidades: UNIDADES,
      confirmacoes: [{ data: QUI, unidade: "GOIANIA", confirmadoEm: new Date() }],
      de: QUI,
      ate: QUI,
    });
    assert.equal(p.length, 1);
    assert.equal(p[0]!.unidade, "TERESINA");
  });

  it("confirmação registrada sem data de conferência não conta", () => {
    // Linha criada mas ninguém confirmou: continua pendente.
    const p = pendenciasDeDomicilio({
      unidades: ["GOIANIA"],
      confirmacoes: [{ data: QUI, unidade: "GOIANIA", confirmadoEm: null }],
      de: QUI,
      ate: QUI,
    });
    assert.equal(p.length, 1);
  });

  it("mais de um dia útil sem conferência entra em alerta", () => {
    const umDia = pendenciasDeDomicilio({
      unidades: ["GOIANIA"],
      confirmacoes: [{ data: QUA, unidade: "GOIANIA", confirmadoEm: new Date() }],
      de: SEG,
      ate: QUI,
    });
    assert.equal(domicilioEmAlerta(umDia), false, "um dia útil ainda é tolerado");

    const doisDias = pendenciasDeDomicilio({
      unidades: ["GOIANIA"],
      confirmacoes: [{ data: TER, unidade: "GOIANIA", confirmadoEm: new Date() }],
      de: SEG,
      ate: QUI,
    });
    assert.equal(domicilioEmAlerta(doisDias), true);
  });

  it("nunca conferido: todos os dias úteis do intervalo pendem", () => {
    const p = pendenciasDeDomicilio({
      unidades: ["GOIANIA"],
      confirmacoes: [],
      de: SEG,
      ate: SEX,
    });
    assert.equal(p.length, 5);
    assert.equal(domicilioEmAlerta(p), true);
  });
});

describe("resumo para o painel", () => {
  it("agrupa dias repetidos por inscrição em uma linha só", () => {
    // Dez dias sem captura para três inscrições dá trinta linhas idênticas.
    // Parede de texto repetido deixa de ser lida.
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: ["a", "b", "c"],
      batimentos: [],
      de: SEG,
      ate: SEX,
    });
    assert.equal(p.length, 15, "cinco dias úteis × três inscrições");

    const resumo = resumirPendencias(p);
    assert.equal(resumo.length, 3, "uma linha por inscrição");
    assert.ok(resumo.every((r) => r.dias === 5));
    assert.ok(resumo.every((r) => r.desde === SEG && r.ate === SEX));
  });

  it("separa situações diferentes da mesma inscrição", () => {
    const p = pendenciasDeCaptura({
      inscricoesMonitoradas: [OAB],
      batimentos: [
        batimento({ data: SEG, status: "FALHA" }),
        batimento({ data: TER, status: "CONCLUIDA_SEM_PUBLICACOES" }),
      ],
      de: SEG,
      ate: TER,
    });
    const resumo = resumirPendencias(p);
    assert.equal(resumo.length, 2);
    assert.deepEqual(
      resumo.map((r) => r.situacao).sort(),
      ["AGUARDA_CONFIRMACAO", "FALHA"],
    );
  });

  it("ordena pelo pior: mais dias primeiro", () => {
    const resumo = resumirPendencias([
      { data: SEG, inscricaoOabId: "a", situacao: "SEM_REGISTRO", motivo: "x" },
      { data: SEG, inscricaoOabId: "b", situacao: "SEM_REGISTRO", motivo: "x" },
      { data: TER, inscricaoOabId: "b", situacao: "SEM_REGISTRO", motivo: "x" },
      { data: QUA, inscricaoOabId: "b", situacao: "SEM_REGISTRO", motivo: "x" },
    ]);
    assert.equal(resumo[0]!.inscricaoOabId, "b");
    assert.equal(resumo[0]!.dias, 3);
  });

  it("lista vazia continua vazia", () => {
    assert.deepEqual(resumirPendencias([]), []);
  });
});

describe("último dia útil", () => {
  it("devolve o próprio dia quando é útil", () => {
    assert.equal(ultimoDiaUtil(QUA), QUA);
  });

  it("sábado e domingo voltam para a sexta", () => {
    assert.equal(ultimoDiaUtil("2026-03-07"), SEX);
    assert.equal(ultimoDiaUtil("2026-03-08"), SEX);
  });

  it("é o que impede o contador de atraso de parecer quebrado", () => {
    // Confirmar num domingo registraria um dia que a vigilância não cobra:
    // o atraso não baixaria e o usuário concluiria que o sistema falhou.
    const domingo = "2026-03-08";
    const p = pendenciasDeDomicilio({
      unidades: ["GOIANIA"],
      confirmacoes: [
        { data: ultimoDiaUtil(domingo), unidade: "GOIANIA", confirmadoEm: new Date() },
      ],
      de: SEG,
      ate: SEX,
    });
    assert.deepEqual(p, [], "confirmando a sexta, a unidade fica em dia");
  });
});
