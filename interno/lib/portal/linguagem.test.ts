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

describe("acesso ao portal", () => {
  it("hash não é o token, e a conferência é em tempo constante", async () => {
    const { conferirAcesso, expiracao, gerarTokenPortal, hashTokenPortal, tokensConferem } = await import("./acesso.ts");
    const token = gerarTokenPortal();
    const hash = hashTokenPortal(token);
    assert.notEqual(hash, token);
    assert.equal(hash.length, 64);
    assert.equal(hashTokenPortal(token), hash);
    assert.ok(tokensConferem(hash, hashTokenPortal(token)));
    assert.ok(!tokensConferem(hash, hashTokenPortal(gerarTokenPortal())));
    assert.ok(!tokensConferem(hash, "curto"));

    const agora = new Date("2026-09-12T12:00:00Z");
    assert.deepEqual(conferirAcesso(null, agora), { valido: false, motivo: "inexistente" });
    assert.deepEqual(conferirAcesso({ revogadoEm: agora, expiraEm: expiracao(30, agora) }, agora), { valido: false, motivo: "revogado" });
    assert.deepEqual(conferirAcesso({ revogadoEm: null, expiraEm: new Date(agora.getTime() - 1) }, agora), { valido: false, motivo: "expirado" });
    assert.deepEqual(conferirAcesso({ revogadoEm: null, expiraEm: expiracao(30, agora) }, agora), { valido: true });
  });
});
