import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { haRevisaoBloqueante, revisoesPendentes } from "./revisao.ts";

const tri = (sigla: string, ano: number, status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA", vigente: boolean) =>
  ({ tribunalId: `${sigla}-${ano}`, tribunalSigla: sigla, ano, status, temCalendarioVigente: vigente });

describe("revisoesPendentes", () => {
  it("em novembro cobra o ano seguinte, com antecedência", () => {
    const p = revisoesPendentes([tri("TRT-18", 2027, "PENDENTE", false)], "2026-11-03");
    assert.equal(p.length, 1);
    assert.equal(p[0]!.urgencia, "ANTECIPADA");
  });
  it("antes de novembro não cobra o ano seguinte", () => {
    assert.deepEqual(revisoesPendentes([tri("TRT-18", 2027, "PENDENTE", false)], "2026-10-31"), []);
  });
  it("ano corrente sem calendário vigente é bloqueante", () => {
    const p = revisoesPendentes([tri("TRT-22", 2026, "PENDENTE", false)], "2026-03-01");
    assert.equal(p[0]!.urgencia, "VENCIDA");
    assert.ok(p[0]!.motivo.includes("RECUSA"));
    assert.ok(haRevisaoBloqueante(p));
  });
  it("ano corrente com vigente mas sem revisão é urgente, não bloqueante", () => {
    const p = revisoesPendentes([tri("TJGO", 2026, "EM_ANDAMENTO", true)], "2026-03-01");
    assert.equal(p[0]!.urgencia, "URGENTE");
    assert.ok(!haRevisaoBloqueante(p));
  });
  it("revisão concluída não aparece", () => {
    assert.deepEqual(revisoesPendentes([tri("TRT-16", 2026, "CONCLUIDA", true)], "2026-03-01"), []);
  });
  it("ordena do mais grave ao menos grave", () => {
    const p = revisoesPendentes(
      [tri("TJPI", 2027, "PENDENTE", false), tri("TJGO", 2026, "PENDENTE", true), tri("TRT-18", 2026, "PENDENTE", false)],
      "2026-11-20",
    );
    assert.deepEqual(p.map((x) => [x.tribunalSigla, x.urgencia]), [
      ["TRT-18", "VENCIDA"], ["TJGO", "URGENTE"], ["TJPI", "ANTECIPADA"],
    ]);
  });
});
