import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cargaPorAdvogado, conversao, funil, resumoDeRisco } from "./indicadores.ts";

const hoje = "2026-09-12";
const prazos = [
  { id: "1", status: "CONFIRMADO", dataFatal: "2026-09-15", cumpridoEm: null, responsavelId: "a", responsavelNome: "Ana" },
  { id: "2", status: "PENDENTE_CONFERENCIA", dataFatal: "2026-09-30", cumpridoEm: null, responsavelId: "a", responsavelNome: "Ana" },
  { id: "3", status: "CONFIRMADO", dataFatal: "2026-09-10", cumpridoEm: null, responsavelId: "a", responsavelNome: "Ana" },
  { id: "4", status: "CUMPRIDO", dataFatal: "2026-08-20", cumpridoEm: "2026-08-20", responsavelId: "b", responsavelNome: "Bruno" },
  { id: "5", status: "CUMPRIDO", dataFatal: "2026-08-25", cumpridoEm: "2026-08-21", responsavelId: "b", responsavelNome: "Bruno" },
  { id: "6", status: "PERDIDO", dataFatal: "2026-07-01", cumpridoEm: null, responsavelId: "b", responsavelNome: "Bruno" },
];

describe("cargaPorAdvogado", () => {
  const carga = cargaPorAdvogado(prazos, hoje);
  it("ordena por carga em curso e conta o que está vencendo", () => {
    assert.equal(carga[0]!.nome, "Ana");
    assert.equal(carga[0]!.emCurso, 3);
    assert.equal(carga[0]!.vencendoEm7Dias, 1);
    assert.equal(carga[0]!.pendentesConferencia, 1);
  });
  it("separa perdidos de salvos no limite", () => {
    const bruno = carga.find((c) => c.nome === "Bruno")!;
    assert.equal(bruno.perdidos, 1);
    assert.equal(bruno.salvosNoLimite, 1);
    assert.equal(bruno.emCurso, 0);
  });
});

describe("resumoDeRisco", () => {
  it("conta vencido sem baixa como risco vivo", () => {
    assert.deepEqual(resumoDeRisco(prazos, hoje), {
      emCurso: 3, vencidosSemBaixa: 1, pendentesConferencia: 1, perdidos: 1, salvosNoLimite: 1,
    });
  });
});

describe("funil e conversão", () => {
  it("monta as etapas na ordem e calcula percentual", () => {
    const f = funil({ leadsComConsentimento: 40, leadsEmContato: 25, leadsConvertidos: 10, clientesComProcesso: 8 });
    assert.deepEqual(f.map((e) => e.quantidade), [40, 25, 10, 8]);
    assert.equal(conversao(40, 10), "25%");
    assert.equal(conversao(0, 5), "—");
  });
});
