import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { avaliar, chaveDe, POLITICA_LOGIN } from "./janela.ts";

const t0 = new Date("2026-09-12T12:00:00Z");
const mais = (s: number) => new Date(t0.getTime() + s * 1000);

describe("janela deslizante", () => {
  it("primeira tentativa abre a janela", () => {
    const d = avaliar(null, POLITICA_LOGIN, t0);
    assert.equal(d.permitido, true);
    assert.equal(d.restantes, 9);
    assert.deepEqual(d.estado, { inicio: t0, contagem: 1 });
  });

  it("permite até o máximo e bloqueia a seguinte", () => {
    let estado = avaliar(null, POLITICA_LOGIN, t0).estado;
    for (let i = 2; i <= POLITICA_LOGIN.maximo; i++) {
      const d = avaliar(estado, POLITICA_LOGIN, mais(i));
      assert.equal(d.permitido, true, `tentativa ${i}`);
      estado = d.estado;
    }
    const bloqueada = avaliar(estado, POLITICA_LOGIN, mais(60));
    assert.equal(bloqueada.permitido, false);
    assert.equal(bloqueada.restantes, 0);
    assert.equal(bloqueada.esperaSegundos, 240);
  });

  it("insistir depois do limite não reabre a janela", () => {
    let estado = { inicio: t0, contagem: POLITICA_LOGIN.maximo };
    for (const s of [10, 20, 30]) {
      const d = avaliar(estado, POLITICA_LOGIN, mais(s));
      assert.equal(d.permitido, false);
      estado = d.estado;
    }
    assert.equal(estado.contagem, POLITICA_LOGIN.maximo + 3);
    // A espera continua medindo do início da janela, não da última tentativa.
    assert.equal(avaliar(estado, POLITICA_LOGIN, mais(30)).esperaSegundos, 270);
  });

  it("passada a janela, recomeça do zero", () => {
    const estado = { inicio: t0, contagem: 50 };
    const d = avaliar(estado, POLITICA_LOGIN, mais(POLITICA_LOGIN.janelaSegundos));
    assert.equal(d.permitido, true);
    assert.equal(d.estado.contagem, 1);
  });
});

describe("chaveDe", () => {
  it("não guarda o IP em claro e separa escopos", () => {
    const chave = chaveDe("login", "203.0.113.7", "segredo");
    assert.ok(!chave.includes("203.0.113.7"));
    assert.ok(chave.startsWith("login:"));
    assert.equal(chave, chaveDe("login", "203.0.113.7", "segredo"));
    assert.notEqual(chave, chaveDe("portal", "203.0.113.7", "segredo"));
    assert.notEqual(chave, chaveDe("login", "203.0.113.8", "segredo"));
    assert.notEqual(chave, chaveDe("login", "203.0.113.7", "outro"));
  });
});
