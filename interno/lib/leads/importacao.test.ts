import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analisarCsv, importarLeads, interpretarData, mapearCabecalho, somenteDigitosTelefone } from "./importacao.ts";

describe("analisarCsv", () => {
  it("aceita ponto e vírgula, vírgula, aspas e BOM", () => {
    assert.deepEqual(analisarCsv("\uFEFFa;b\r\n1;\"x;y\"\r\n"), [["a", "b"], ["1", "x;y"]]);
    assert.deepEqual(analisarCsv('a,b\n"diz ""oi""",2\n'), [["a", "b"], ['diz "oi"', "2"]]);
  });
});

describe("mapearCabecalho", () => {
  it("tolera acento, caixa e sinônimo", () => {
    const m = mapearCabecalho(["Carimbo de data/hora", "Nome completo", "Telefone", "E-mail", "Deseja contato?", "Simulador"]);
    assert.equal(m["consentimentoEm"], 0);
    assert.equal(m["nome"], 1);
    assert.equal(m["whatsapp"], 2);
    assert.equal(m["email"], 3);
    assert.equal(m["solicitouContato"], 4);
    assert.equal(m["simulador"], 5);
  });
});

describe("interpretarData e telefone", () => {
  it("entende formatos do Sheets", () => {
    assert.equal(interpretarData("15/03/2026 14:22:10")?.toISOString(), "2026-03-15T17:22:10.000Z");
    assert.equal(interpretarData("2026-03-15")?.toISOString(), "2026-03-15T00:00:00.000Z");
    assert.equal(interpretarData("sem data"), null);
  });
  it("normaliza telefone com +55", () => {
    assert.equal(somenteDigitosTelefone("+55 (62) 99999-1234"), "62999991234");
    assert.equal(somenteDigitosTelefone("62 3333-1234"), "6233331234");
  });
});

describe("importarLeads — consentimento datado é condição para a fila", () => {
  const csv = [
    "Carimbo de data/hora;Nome;WhatsApp;E-mail;Deseja contato?;Simulador;Resultado",
    "10/02/2026 09:00:00;Ana Silva;(62) 99999-1111;ana@x.com;Sim;Precatório;1234",
    ";Bruno Souza;62988882222;;Sim;Verbas rescisórias;99",
    "11/02/2026 10:00:00;Carla Lima;62977773333;;Não;Verbas;7",
    "12/02/2026;;123;errado;Sim;;",
  ].join("\n");
  const leads = importarLeads(csv, "site/simulador");

  it("lead com pedido e data entra pronto para contato, com origem e payload", () => {
    const ana = leads[0]!;
    assert.deepEqual(ana.erros, []);
    assert.equal(ana.solicitouContato, true);
    assert.equal(ana.simulador, "PRECATORIO_RPV");
    assert.equal(ana.consentimentoEm?.toISOString(), "2026-02-10T12:00:00.000Z");
    assert.equal(ana.origem, "site/simulador");
    assert.deepEqual(ana.payload, { Resultado: "1234" });
  });
  it("pedido de contato SEM data vira erro e NÃO entra na fila", () => {
    const bruno = leads[1]!;
    assert.equal(bruno.solicitouContato, false);
    assert.ok(bruno.erros.some((e) => e.includes("data do consentimento")));
  });
  it("quem não pediu contato fica sem consentimento e sem erro", () => {
    const carla = leads[2]!;
    assert.deepEqual(carla.erros, []);
    assert.equal(carla.solicitouContato, false);
    assert.equal(carla.consentimentoEm, null);
    assert.equal(carla.simulador, "VERBAS_RESCISORIAS");
  });
  it("linha inválida é marcada, não silenciada", () => {
    const ruim = leads[3]!;
    assert.ok(ruim.erros.includes("Nome ausente."));
    assert.ok(ruim.erros.some((e) => e.includes("WhatsApp")));
    assert.ok(ruim.erros.some((e) => e.includes("E-mail")));
  });
});
