import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  cifrar,
  conferirSenha,
  decifrar,
  gerarHashSenha,
  gerarTokenAleatorio,
  hashToken,
} from "./cripto.ts";

before(() => {
  process.env["CHAVE_CRIPTOGRAFIA_V1"] = randomBytes(32).toString("base64");
  process.env["CHAVE_CRIPTOGRAFIA_V2"] = randomBytes(32).toString("base64");
  process.env["CHAVE_CRIPTOGRAFIA_VERSAO_ATUAL"] = "1";
});

describe("cifragem de dado sensivel (AES-256-GCM)", () => {
  const contexto = "dado_sensivel:44444444-4444-4444-4444-444444444444";

  it("faz ida e volta preservando o conteudo", () => {
    const claro = "CID M54.5 — lombalgia cronica. Laudo de 12/03/2026.";
    const { blob, versaoChave } = cifrar(claro, contexto);
    assert.equal(decifrar(blob, contexto, versaoChave), claro);
  });

  it("nao vaza o texto claro no blob", () => {
    const { blob } = cifrar("CID F41.1", contexto);
    assert.equal(blob.includes(Buffer.from("CID", "utf8")), false);
    assert.equal(blob.includes(Buffer.from("F41.1", "utf8")), false);
  });

  it("produz blobs diferentes para o mesmo texto (IV aleatorio)", () => {
    const a = cifrar("mesmo texto", contexto).blob;
    const b = cifrar("mesmo texto", contexto).blob;
    assert.notDeepEqual(a, b);
  });

  it("recusa blob adulterado — falha fechada, nao devolve lixo", () => {
    const { blob, versaoChave } = cifrar("laudo pericial", contexto);
    const adulterado = Buffer.from(blob);
    adulterado[adulterado.length - 1] ^= 0xff;
    assert.throws(() => decifrar(adulterado, contexto, versaoChave));
  });

  it("recusa blob de OUTRO registro (o contexto entra como AAD)", () => {
    // Sem AAD, copiar o blob de um cliente para a linha de outro decifraria
    // normalmente. Com AAD, nao decifra.
    const { blob, versaoChave } = cifrar("laudo do cliente A", contexto);
    const outroContexto = "dado_sensivel:99999999-9999-9999-9999-999999999999";
    assert.throws(() => decifrar(blob, outroContexto, versaoChave));
  });

  it("recusa blob truncado", () => {
    const { blob, versaoChave } = cifrar("x", contexto);
    assert.throws(() => decifrar(blob.subarray(0, 10), contexto, versaoChave));
  });

  it("suporta rotacao: blob da v1 continua legivel apos a v2 virar atual", () => {
    const { blob, versaoChave } = cifrar("laudo antigo", contexto, 1);
    process.env["CHAVE_CRIPTOGRAFIA_VERSAO_ATUAL"] = "2";
    try {
      assert.equal(decifrar(blob, contexto, versaoChave), "laudo antigo");
      const novo = cifrar("laudo novo", contexto);
      assert.equal(novo.versaoChave, 2);
      assert.equal(decifrar(novo.blob, contexto, 2), "laudo novo");
    } finally {
      process.env["CHAVE_CRIPTOGRAFIA_VERSAO_ATUAL"] = "1";
    }
  });

  it("falha alto quando a chave nao esta no ambiente", () => {
    assert.throws(() => cifrar("x", contexto, 99), /Chave de criptografia versao 99/);
  });
});

describe("hash de senha (scrypt)", () => {
  it("aceita a senha correta", () => {
    const hash = gerarHashSenha("senha-forte-do-escritorio");
    assert.equal(conferirSenha("senha-forte-do-escritorio", hash), true);
  });

  it("recusa senha errada", () => {
    const hash = gerarHashSenha("senha-forte-do-escritorio");
    assert.equal(conferirSenha("senha-forte-do-escritori", hash), false);
    assert.equal(conferirSenha("", hash), false);
  });

  it("usa sal aleatorio: senhas iguais geram hashes diferentes", () => {
    assert.notEqual(gerarHashSenha("igual"), gerarHashSenha("igual"));
  });

  it("normaliza unicode (NFKC): acento digitado em outro teclado ainda entra", () => {
    // Acentos tem duas representacoes em Unicode — pre-composta (NFC) e
    // decomposta (NFD). Teclados e sistemas operacionais diferentes produzem
    // formas distintas para a MESMA senha digitada. Sem normalizar, o advogado
    // seria barrado no proprio login por um detalhe invisivel.
    const senha = "Advocacia-Cao-2026".replace("Cao", "C\u00e3o");
    assert.notEqual(
      senha.normalize("NFC"),
      senha.normalize("NFD"),
      "o caso de teste precisa ter representacoes distintas para ter valor",
    );

    const hash = gerarHashSenha(senha.normalize("NFC"));
    assert.equal(conferirSenha(senha.normalize("NFD"), hash), true);
    assert.equal(conferirSenha(senha.normalize("NFC"), hash), true);
  });

  it("recusa hash malformado sem lancar excecao", () => {
    for (const ruim of ["", "abc", "scrypt$1$2$3", "bcrypt$1$8$1$a$b", "$$$$$"]) {
      assert.equal(conferirSenha("x", ruim), false, ruim);
    }
  });
});

describe("tokens", () => {
  it("gera tokens distintos e url-safe", () => {
    const tokens = Array.from({ length: 100 }, () => gerarTokenAleatorio());
    assert.equal(new Set(tokens).size, 100);
    for (const t of tokens) assert.match(t, /^[A-Za-z0-9_-]+$/);
  });

  it("hash de token e estavel e nao reversivel por tamanho", () => {
    const token = gerarTokenAleatorio();
    assert.equal(hashToken(token), hashToken(token));
    assert.equal(hashToken(token).length, 64);
    assert.notEqual(hashToken(token), token);
  });
});
