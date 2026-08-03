import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  alertasDoDia,
  pendentesDeConferencia,
  prazosVencidosSemBaixa,
  severidade,
  type PrazoParaAlerta,
} from "./alertas.ts";

const ADVOGADA = "adv-1";
const SOCIO = "socio-1";

function prazo(over: Partial<PrazoParaAlerta> = {}): PrazoParaAlerta {
  return {
    id: "prazo-1",
    dataFatal: "2026-03-20",
    status: "CONFIRMADO",
    responsavelId: ADVOGADA,
    socioResponsavelId: SOCIO,
    temTratativa: false,
    marcosJaEnviados: [],
    ...over,
  };
}

describe("marcos de alerta", () => {
  const casos: ReadonlyArray<readonly [string, string]> = [
    ["2026-03-10", "D_10"],
    ["2026-03-15", "D_5"],
    ["2026-03-17", "D_3"],
    ["2026-03-18", "D_2"],
    ["2026-03-19", "D_1"],
    ["2026-03-20", "D_0"],
  ];

  for (const [hoje, esperado] of casos) {
    it(`${hoje} dispara ${esperado}`, () => {
      const r = alertasDoDia([prazo({ temTratativa: true })], hoje);
      assert.equal(r.length, 1);
      assert.equal(r[0]!.marco, esperado);
      assert.equal(r[0]!.destinatarioId, ADVOGADA);
      assert.equal(r[0]!.escalonamento, false);
    });
  }

  it("não dispara antes de D-10", () => {
    assert.deepEqual(alertasDoDia([prazo({ temTratativa: true })], "2026-03-09"), []);
  });

  it("não repete marco já enviado", () => {
    const r = alertasDoDia(
      [prazo({ temTratativa: true, marcosJaEnviados: ["D_10"] })],
      "2026-03-10",
    );
    assert.deepEqual(r, []);
  });

  it("cron atrasado manda o marco MAIS PRÓXIMO, não a fila inteira", () => {
    // Se o cron ficou fora do ar de D-10 a D-3, o advogado precisa ler
    // "faltam 3 dias" — e não receber D-10 e D-5 já superados, que confundem
    // mais do que informam. O histórico continua visível no painel.
    const r = alertasDoDia([prazo({ temTratativa: true })], "2026-03-17");
    assert.equal(r.length, 1);
    assert.equal(r[0]!.marco, "D_3");
  });
});

describe("escalonamento ao sócio a partir de D-3", () => {
  it("NÃO escala em D-5, mesmo sem tratativa", () => {
    const r = alertasDoDia([prazo({ temTratativa: false })], "2026-03-15");
    assert.equal(r.length, 1);
    assert.equal(r[0]!.escalonamento, false);
  });

  it("escala em D-3 quando não há tratativa registrada", () => {
    const r = alertasDoDia([prazo({ temTratativa: false })], "2026-03-17");
    assert.equal(r.length, 2);
    const escalado = r.find((a) => a.escalonamento);
    assert.ok(escalado, "o sócio precisa ser avisado");
    assert.equal(escalado.destinatarioId, SOCIO);
    // O responsável continua recebendo o dele: escalar não é substituir.
    assert.ok(r.some((a) => a.destinatarioId === ADVOGADA && !a.escalonamento));
  });

  it("NÃO escala quando há tratativa registrada", () => {
    const r = alertasDoDia([prazo({ temTratativa: true })], "2026-03-17");
    assert.equal(r.length, 1);
    assert.equal(r[0]!.escalonamento, false);
  });

  it("continua escalando em D-2, D-1 e no dia", () => {
    for (const hoje of ["2026-03-18", "2026-03-19", "2026-03-20"]) {
      const r = alertasDoDia([prazo({ temTratativa: false })], hoje);
      assert.ok(r.some((a) => a.escalonamento), hoje);
    }
  });

  it("não escala para o próprio responsável quando ele é o sócio", () => {
    const r = alertasDoDia(
      [prazo({ responsavelId: SOCIO, socioResponsavelId: SOCIO })],
      "2026-03-17",
    );
    assert.equal(r.length, 1);
    assert.equal(r[0]!.escalonamento, false);
  });

  it("não quebra quando não há sócio designado", () => {
    const r = alertasDoDia([prazo({ socioResponsavelId: null })], "2026-03-17");
    assert.equal(r.length, 1);
  });
});

describe("status que não geram alerta", () => {
  for (const status of ["CUMPRIDO", "CANCELADO", "PERDIDO", "PREJUDICADO"] as const) {
    it(`${status} não gera alerta`, () => {
      assert.deepEqual(alertasDoDia([prazo({ status })], "2026-03-17"), []);
    });
  }

  it("PENDENTE_CONFERENCIA GERA alerta — prazo não conferido é o que mais preocupa", () => {
    const r = alertasDoDia(
      [prazo({ status: "PENDENTE_CONFERENCIA", temTratativa: true })],
      "2026-03-17",
    );
    assert.equal(r.length, 1);
  });

  it("EM_TRATATIVA continua gerando alerta", () => {
    const r = alertasDoDia(
      [prazo({ status: "EM_TRATATIVA", temTratativa: true })],
      "2026-03-19",
    );
    assert.equal(r.length, 1);
  });
});

describe("prazo vencido sem baixa", () => {
  it("não gera alerta novo, mas aparece na lista de pendências", () => {
    const vencido = prazo({ dataFatal: "2026-03-10" });
    assert.deepEqual(alertasDoDia([vencido], "2026-03-17"), []);
    assert.equal(prazosVencidosSemBaixa([vencido], "2026-03-17").length, 1);
  });

  it("prazo cumprido sai da lista de pendências", () => {
    const cumprido = prazo({ dataFatal: "2026-03-10", status: "CUMPRIDO" });
    assert.deepEqual(prazosVencidosSemBaixa([cumprido], "2026-03-17"), []);
  });

  it("prazo do próprio dia ainda não é vencido", () => {
    const hoje = prazo({ dataFatal: "2026-03-17" });
    assert.deepEqual(prazosVencidosSemBaixa([hoje], "2026-03-17"), []);
  });
});

describe("pendentes de conferência", () => {
  it("separa os que aguardam ato do advogado", () => {
    const lista = [
      prazo({ id: "a", status: "PENDENTE_CONFERENCIA" }),
      prazo({ id: "b", status: "CONFIRMADO" }),
      prazo({ id: "c", status: "PENDENTE_CONFERENCIA" }),
    ];
    assert.deepEqual(
      pendentesDeConferencia(lista).map((p) => p.id),
      ["a", "c"],
    );
  });
});

describe("severidade para exibição", () => {
  it("classifica pela distância até a data fatal", () => {
    assert.equal(severidade({ dataFatal: "2026-03-10", status: "CONFIRMADO" }, "2026-03-17"), "vencido");
    assert.equal(severidade({ dataFatal: "2026-03-17", status: "CONFIRMADO" }, "2026-03-17"), "hoje");
    assert.equal(severidade({ dataFatal: "2026-03-19", status: "CONFIRMADO" }, "2026-03-17"), "critico");
    assert.equal(severidade({ dataFatal: "2026-03-25", status: "CONFIRMADO" }, "2026-03-17"), "atencao");
    assert.equal(severidade({ dataFatal: "2026-04-30", status: "CONFIRMADO" }, "2026-03-17"), "normal");
  });

  it("prazo não conferido nunca é 'normal', ainda que distante", () => {
    // Prazo capturado e não conferido não é prazo controlado: exibi-lo como
    // rotina daria falsa sensação de controle.
    assert.equal(
      severidade({ dataFatal: "2026-12-30", status: "PENDENTE_CONFERENCIA" }, "2026-03-17"),
      "atencao",
    );
  });
});

describe("vários prazos de uma vez", () => {
  it("processa a carteira inteira numa passada", () => {
    const r = alertasDoDia(
      [
        prazo({ id: "p1", dataFatal: "2026-03-20", temTratativa: true }),
        prazo({ id: "p2", dataFatal: "2026-03-18", temTratativa: false }),
        prazo({ id: "p3", dataFatal: "2026-06-01" }),
        prazo({ id: "p4", dataFatal: "2026-03-19", status: "CUMPRIDO" }),
      ],
      "2026-03-17",
    );
    const ids = r.map((a) => a.prazoId).sort();
    // p1 em D-3 (com tratativa, sem escalonamento); p2 em D-1 com escalonamento;
    // p3 longe demais; p4 cumprido.
    assert.deepEqual(ids, ["p1", "p2", "p2"]);
  });
});
