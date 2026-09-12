import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validarTexto } from "../mensagens/compliance.ts";
import { GRAU_EM_LINGUAGEM_SIMPLES, SITUACAO_EM_LINGUAGEM_SIMPLES, TEXTOS_PORTAL } from "./linguagem.ts";

describe("portal do cliente — todo texto fixo passa na validação anti-promessa", () => {
  const todos = [
    ...Object.values(SITUACAO_EM_LINGUAGEM_SIMPLES),
    ...Object.values(TEXTOS_PORTAL),
    ...Object.values(GRAU_EM_LINGUAGEM_SIMPLES),
  ];
  for (const t of todos) {
    it(t.slice(0, 60), () => {
      assert.deepEqual(validarTexto(t), []);
    });
  }
  it("cobre todas as situações de processo", () => {
    for (const s of ["EM_ANDAMENTO", "EM_EXECUCAO", "SUSPENSO", "ARQUIVADO", "BAIXADO", "EXTINTO", "TRANSITADO_JULGADO"]) {
      assert.ok(SITUACAO_EM_LINGUAGEM_SIMPLES[s], s);
    }
  });
});
