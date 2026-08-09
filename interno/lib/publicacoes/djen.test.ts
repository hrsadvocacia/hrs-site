import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { montarUrl, mapear, FonteDjen, BASE_DJEN } from "./djen.ts";
import { ContratoNaoVerificadoError, FalhaNaFonteError } from "./fonte.ts";

const CONSULTA = {
  numeroOab: "76478",
  ufOab: "go",
  de: "2026-08-01",
  ate: "2026-08-08",
};

describe("montagem da consulta ao DJEN", () => {
  it("usa o endereço da consulta pública", () => {
    assert.ok(montarUrl(CONSULTA).startsWith(BASE_DJEN + "?"));
  });

  it("leva OAB, UF e intervalo de disponibilização", () => {
    const url = new URL(montarUrl(CONSULTA));
    assert.equal(url.searchParams.get("numeroOab"), "76478");
    assert.equal(url.searchParams.get("ufOab"), "GO");
    assert.equal(url.searchParams.get("dataDisponibilizacaoInicio"), "2026-08-01");
    assert.equal(url.searchParams.get("dataDisponibilizacaoFim"), "2026-08-08");
  });

  it("normaliza a OAB para dígitos e a UF para maiúsculas", () => {
    const url = new URL(montarUrl({ ...CONSULTA, numeroOab: "76.478", ufOab: "go" }));
    assert.equal(url.searchParams.get("numeroOab"), "76478");
    assert.equal(url.searchParams.get("ufOab"), "GO");
  });
});

describe("leitura da resposta — deliberadamente não implementada", () => {
  it("mapear() recusa interpretar qualquer payload", () => {
    // Este teste existe para TRAVAR a ausência do mapeamento. Se alguém
    // escrever um mapeamento por suposição, este teste quebra e obriga a
    // conversa sobre onde veio o contrato.
    assert.throws(() => mapear({ conteudo: [] }), ContratoNaoVerificadoError);
    assert.throws(() => mapear([]), ContratoNaoVerificadoError);
    assert.throws(() => mapear(null), ContratoNaoVerificadoError);
  });

  it("a mensagem diz como concluir", () => {
    try {
      mapear({});
      assert.fail("deveria ter lançado");
    } catch (e) {
      assert.ok(e instanceof ContratoNaoVerificadoError);
      assert.equal(e.fonte, "DJEN");
      assert.match(e.message, /resposta real/i);
    }
  });
});

describe("a fonte falha alto, nunca em silêncio", () => {
  it("erro de rede vira FalhaNaFonteError, não lista vazia", async () => {
    // Endereço que não resolve. O importante é a CLASSE do erro: reportar
    // "nenhuma publicação" diante de rede fora seria o pior desfecho.
    const fonte = new FonteDjen({
      base: "https://endereco-que-nao-existe.invalid/api",
      tempoLimiteMs: 2000,
    });
    await assert.rejects(() => fonte.consultar(CONSULTA), FalhaNaFonteError);
  });

  it("nunca devolve lista vazia por engano", async () => {
    const fonte = new FonteDjen({
      base: "https://endereco-que-nao-existe.invalid/api",
      tempoLimiteMs: 2000,
    });
    let resultado: unknown = "não deveria chegar aqui";
    try {
      resultado = await fonte.consultar(CONSULTA);
    } catch {
      resultado = "lançou";
    }
    assert.equal(resultado, "lançou");
  });
});
