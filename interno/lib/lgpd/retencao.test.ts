import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { anonimizarCliente, anonimizarLead, vencidos } from "./retencao.ts";

describe("retenção", () => {
  it("lista só o vencido e ainda não anonimizado", () => {
    const r = vencidos(
      [
        { id: "a", descartarApos: "2026-01-01", anonimizadoEm: null },
        { id: "b", descartarApos: "2026-12-31", anonimizadoEm: null },
        { id: "c", descartarApos: null, anonimizadoEm: null },
        { id: "d", descartarApos: "2025-01-01", anonimizadoEm: new Date() },
        { id: "e", descartarApos: "2026-06-01", anonimizadoEm: null },
      ],
      "2026-06-01",
    );
    assert.deepEqual(r.map((x) => x.id), ["a", "e"]);
  });
  it("anonimização apaga identificação e mantém unicidade do CPF", () => {
    const a = anonimizarCliente("11111111-2222-3333-4444-555555555555");
    assert.equal(a.cpfCnpj, "ANON-11111111-2222-3333-4444-555555555555");
    assert.equal(a.rg, null);
    assert.equal(a.ativo, false);
    const l = anonimizarLead("abcdefgh-0000");
    assert.equal(l.whatsapp, "00000000000");
    assert.deepEqual(l.payload, {});
  });
});
