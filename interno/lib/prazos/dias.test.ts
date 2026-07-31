import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  diaDaSemana,
  diferencaEmDias,
  fimDeSemana,
  formatarBR,
  noRecesso,
  primeiroDiaAposRecesso,
  proximoDia,
  somarDias,
  validarDataISO,
} from "./dias.ts";

describe("validacao de data", () => {
  it("aceita data valida", () => {
    assert.equal(validarDataISO("2026-03-02"), "2026-03-02");
    assert.equal(validarDataISO("2024-02-29"), "2024-02-29"); // bissexto
  });

  it("recusa formato errado", () => {
    for (const ruim of ["02/03/2026", "2026-3-2", "20260302", "", "hoje"]) {
      assert.throws(() => validarDataISO(ruim), /Data invalida/, ruim);
    }
  });

  it("recusa data que existe no formato mas nao no calendario", () => {
    // 2025 nao e bissexto: 29/02 nao existe e nao pode virar 01/03 em silencio.
    assert.throws(() => validarDataISO("2025-02-29"), /inexistente/);
    assert.throws(() => validarDataISO("2026-02-30"), /inexistente/);
    assert.throws(() => validarDataISO("2026-13-01"), /inexistente/);
  });
});

describe("aritmetica de datas", () => {
  it("soma dias atravessando o fim do mes", () => {
    assert.equal(somarDias("2026-01-31", 1), "2026-02-01");
    assert.equal(somarDias("2026-02-28", 1), "2026-03-01");
    assert.equal(somarDias("2024-02-28", 1), "2024-02-29"); // bissexto
  });

  it("soma dias atravessando a virada de ano", () => {
    assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
    assert.equal(proximoDia("2026-12-31"), "2027-01-01");
    assert.equal(somarDias("2027-01-01", -1), "2026-12-31");
  });

  it("nao sofre com fuso horario nem horario de verao", () => {
    // Todo o calculo e em UTC. Somar 1 dia 400 vezes tem que dar o mesmo que
    // somar 400 de uma vez — o que quebraria se houvesse deslocamento de fuso.
    let passo = "2025-10-01";
    for (let i = 0; i < 400; i++) passo = proximoDia(passo);
    assert.equal(passo, somarDias("2025-10-01", 400));
  });

  it("calcula diferenca em dias", () => {
    assert.equal(diferencaEmDias("2026-03-02", "2026-03-12"), 10);
    assert.equal(diferencaEmDias("2026-12-20", "2027-01-21"), 32);
    assert.equal(diferencaEmDias("2026-03-12", "2026-03-02"), -10);
  });

  it("identifica o dia da semana", () => {
    assert.equal(diaDaSemana("2026-03-02"), 1); // segunda
    assert.equal(diaDaSemana("2026-03-07"), 6); // sabado
    assert.equal(diaDaSemana("2026-03-08"), 0); // domingo
  });

  it("identifica fim de semana", () => {
    assert.equal(fimDeSemana("2026-03-06"), false); // sexta
    assert.equal(fimDeSemana("2026-03-07"), true);
    assert.equal(fimDeSemana("2026-03-08"), true);
    assert.equal(fimDeSemana("2026-03-09"), false); // segunda
  });

  it("formata para o padrao brasileiro", () => {
    assert.equal(formatarBR("2026-03-02"), "02/03/2026");
  });
});

describe("recesso forense — 20/12 a 20/01, inclusive", () => {
  it("inclui as datas de borda", () => {
    assert.equal(noRecesso("2026-12-20"), true, "20/12 esta dentro");
    assert.equal(noRecesso("2027-01-20"), true, "20/01 esta dentro");
  });

  it("exclui o dia anterior e o posterior", () => {
    assert.equal(noRecesso("2026-12-19"), false);
    assert.equal(noRecesso("2027-01-21"), false);
  });

  it("cobre o intervalo inteiro e nada alem", () => {
    assert.equal(noRecesso("2026-12-25"), true);
    assert.equal(noRecesso("2027-01-05"), true);
    assert.equal(noRecesso("2026-11-30"), false);
    assert.equal(noRecesso("2026-02-01"), false);
    assert.equal(noRecesso("2026-07-15"), false);
  });

  it("a retomada em dezembro cai no ano SEGUINTE", () => {
    // Errar essa virada joga a data fatal um ano inteiro fora do lugar.
    assert.equal(primeiroDiaAposRecesso("2026-12-22"), "2027-01-21");
    assert.equal(primeiroDiaAposRecesso("2026-12-31"), "2027-01-21");
  });

  it("a retomada em janeiro cai no PROPRIO ano", () => {
    assert.equal(primeiroDiaAposRecesso("2027-01-05"), "2027-01-21");
    assert.equal(primeiroDiaAposRecesso("2027-01-20"), "2027-01-21");
  });

  it("data fora do recesso e devolvida intacta", () => {
    assert.equal(primeiroDiaAposRecesso("2026-06-10"), "2026-06-10");
  });
});
