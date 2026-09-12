import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { alertasDeLogistica, exigeDeslocamento } from "./regras.ts";
import { dobrarLinha, gerarIcal } from "./ical.ts";

describe("exigeDeslocamento", () => {
  it("mesma praça não exige; praça diferente exige; virtual nunca", () => {
    assert.equal(exigeDeslocamento({ municipio: "GOIÂNIA", uf: "go", virtual: false }, "GOIANIA"), false);
    assert.equal(exigeDeslocamento({ municipio: "Anápolis", uf: "GO", virtual: false }, "GOIANIA"), true);
    assert.equal(exigeDeslocamento({ municipio: "Teresina", uf: "PI", virtual: false }, "GOIANIA"), true);
    assert.equal(exigeDeslocamento({ municipio: "Teresina", uf: "PI", virtual: true }, "GOIANIA"), false);
  });
  it("Teresina e Timon são conurbadas", () => {
    assert.equal(exigeDeslocamento({ municipio: "Timon", uf: "MA", virtual: false }, "TERESINA"), false);
    assert.equal(exigeDeslocamento({ municipio: "Teresina", uf: "PI", virtual: false }, "TIMON"), false);
    assert.equal(exigeDeslocamento({ municipio: "Caxias", uf: "MA", virtual: false }, "TIMON"), true);
  });
});

describe("alertasDeLogistica", () => {
  const hoje = "2026-09-01";
  const c = (dia: string, status = "AGENDADO", desloc = true) => ({
    dia, dataHora: new Date(`${dia}T13:00:00Z`), status, exigeDeslocamento: desloc,
  });
  it("lista só os agendados com deslocamento dentro de 15 dias, do mais próximo ao mais distante", () => {
    const alertas = alertasDeLogistica(
      [c("2026-09-16"), c("2026-09-02"), c("2026-09-17"), c("2026-08-31"), c("2026-09-10", "CANCELADO"), c("2026-09-05", "AGENDADO", false)],
      hoje,
    );
    assert.deepEqual(alertas.map((a) => [a.compromisso.dia, a.diasRestantes]), [["2026-09-02", 1], ["2026-09-16", 15]]);
  });
});

describe("iCal", () => {
  it("gera VEVENT com escape e horário UTC", () => {
    const ical = gerarIcal(
      [{ uid: "abc", titulo: "Audiência; inicial, TRT-18", inicio: new Date("2026-10-05T12:30:00Z"), duracaoMinutos: 90, local: "Fórum Trabalhista\nGoiânia" }],
      new Date("2026-09-01T00:00:00Z"),
    );
    assert.ok(ical.includes("DTSTART:20261005T123000Z"));
    assert.ok(ical.includes("DTEND:20261005T140000Z"));
    assert.ok(ical.includes("SUMMARY:Audiência\; inicial\\, TRT-18"));
    assert.ok(ical.includes("LOCATION:Fórum Trabalhista\\nGoiânia"));
    assert.ok(ical.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ical.endsWith("END:VCALENDAR\r\n"));
  });
  it("dobra linhas longas em 75 octetos sem partir caractere multibyte", () => {
    const longa = "DESCRIPTION:" + "ção".repeat(40);
    const dobrada = dobrarLinha(longa);
    for (const l of dobrada.split("\r\n")) assert.ok(Buffer.byteLength(l, "utf8") <= 75, `${Buffer.byteLength(l)} > 75`);
    assert.equal(dobrada.replace(/\r\n /g, ""), longa);
  });
});
