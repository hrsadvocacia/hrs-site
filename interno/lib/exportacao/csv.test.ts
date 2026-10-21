import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gerarCsv } from "./csv.ts";

describe("gerarCsv", () => {
  it("usa ponto e vírgula, BOM e CRLF", () => {
    const csv = gerarCsv(["a", "b"], [["1", "2"]]);
    assert.equal(csv, "﻿a;b\r\n1;2\r\n");
  });
  it("escapa aspas, separador e quebra de linha", () => {
    const csv = gerarCsv(["x"], [['diz "oi"; tchau\nfim']]);
    assert.equal(csv, '﻿x\r\n"diz ""oi""; tchau\nfim"\r\n');
  });
  it("neutraliza fórmula (CSV injection)", () => {
    const csv = gerarCsv(["x"], [["=HYPERLINK(\"http://x\")"], ["+1"], ["-2"], ["@a"]]);
    assert.ok(csv.includes("'=HYPERLINK"));
    assert.ok(csv.includes("'+1"));
    assert.ok(csv.includes("'-2"));
    assert.ok(csv.includes("'@a"));
  });
  it("nulos viram vazio e números viram texto", () => {
    assert.equal(gerarCsv(["a", "b", "c"], [[null, undefined, 3]]), "﻿a;b;c\r\n;;3\r\n");
  });
});
