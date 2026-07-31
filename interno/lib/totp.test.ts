import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  conferirTotp,
  deBase32,
  gerarCodigosBackup,
  gerarSegredoTotp,
  gerarTotp,
  paraBase32,
  uriTotp,
} from "./totp.ts";

// A RFC 6238 publica vetores de teste no Apendice B. Sao eles que provam que a
// implementacao esta correta — nao a ausencia de erro em uso manual.
const SEMENTE_SHA1 = Buffer.from("12345678901234567890", "ascii");
const SEMENTE_SHA256 = Buffer.from("12345678901234567890123456789012", "ascii");
const SEMENTE_SHA512 = Buffer.from(
  "1234567890123456789012345678901234567890123456789012345678901234",
  "ascii",
);

describe("base32 (RFC 4648)", () => {
  it("codifica a semente da RFC 6238 conforme esperado", () => {
    assert.equal(paraBase32(SEMENTE_SHA1), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("faz ida e volta sem perda", () => {
    for (const texto of ["a", "ab", "abc", "abcd", "abcde", "hrs advocacia"]) {
      const bytes = Buffer.from(texto, "utf8");
      assert.deepEqual(deBase32(paraBase32(bytes)), bytes, texto);
    }
  });

  it("recusa caractere fora do alfabeto", () => {
    assert.throws(() => deBase32("ABC1"), /invalido/);
  });
});

describe("TOTP — vetores oficiais da RFC 6238", () => {
  const vetoresSha1: ReadonlyArray<readonly [number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  for (const [instante, esperado] of vetoresSha1) {
    it(`SHA1 em t=${instante} -> ${esperado}`, () => {
      assert.equal(
        gerarTotp(paraBase32(SEMENTE_SHA1), instante, {
          digitos: 8,
          algoritmo: "sha1",
        }),
        esperado,
      );
    });
  }

  it("SHA256 em t=59 -> 46119246", () => {
    assert.equal(
      gerarTotp(paraBase32(SEMENTE_SHA256), 59, {
        digitos: 8,
        algoritmo: "sha256",
      }),
      "46119246",
    );
  });

  it("SHA512 em t=59 -> 90693936", () => {
    assert.equal(
      gerarTotp(paraBase32(SEMENTE_SHA512), 59, {
        digitos: 8,
        algoritmo: "sha512",
      }),
      "90693936",
    );
  });
});

describe("conferirTotp", () => {
  const segredo = paraBase32(SEMENTE_SHA1);
  const agora = 1_700_000_000;

  it("aceita o codigo do passo corrente", () => {
    const codigo = gerarTotp(segredo, agora);
    assert.equal(conferirTotp(codigo, segredo, { emSegundos: agora }).valido, true);
  });

  it("tolera relogio adiantado ou atrasado em um passo", () => {
    for (const desvio of [-30, 30]) {
      const codigo = gerarTotp(segredo, agora + desvio);
      assert.equal(
        conferirTotp(codigo, segredo, { emSegundos: agora, janela: 1 }).valido,
        true,
        `desvio ${desvio}s`,
      );
    }
  });

  it("recusa codigo fora da janela de tolerancia", () => {
    const codigo = gerarTotp(segredo, agora + 120);
    assert.equal(
      conferirTotp(codigo, segredo, { emSegundos: agora, janela: 1 }).valido,
      false,
    );
  });

  it("recusa codigo errado e codigo com tamanho invalido", () => {
    assert.equal(conferirTotp("000000", segredo, { emSegundos: agora }).valido, false);
    assert.equal(conferirTotp("12345", segredo, { emSegundos: agora }).valido, false);
    assert.equal(conferirTotp("", segredo, { emSegundos: agora }).valido, false);
  });

  it("anti-replay: codigo ja usado nao vale de novo", () => {
    const codigo = gerarTotp(segredo, agora);
    const primeira = conferirTotp(codigo, segredo, { emSegundos: agora });
    assert.equal(primeira.valido, true);
    assert.ok(primeira.contador !== undefined);

    // Segunda tentativa com o mesmo codigo, ainda dentro da janela de 30s.
    const segunda = conferirTotp(codigo, segredo, {
      emSegundos: agora,
      contadorMinimo: primeira.contador!,
    });
    assert.equal(
      segunda.valido,
      false,
      "reuso do mesmo passo deve ser recusado: quem viu o codigo por cima do ombro teria ate 90s para usa-lo",
    );
  });

  it("devolve o contador que casou, para gravacao do anti-replay", () => {
    const codigo = gerarTotp(segredo, agora);
    const r = conferirTotp(codigo, segredo, { emSegundos: agora });
    assert.equal(r.contador, BigInt(Math.floor(agora / 30)));
  });
});

describe("geracao de segredo e URI", () => {
  it("gera segredo de 160 bits, como recomenda a RFC 4226", () => {
    const segredo = gerarSegredoTotp();
    assert.equal(deBase32(segredo).length, 20);
  });

  it("gera segredos distintos a cada chamada", () => {
    const amostras = new Set(Array.from({ length: 50 }, gerarSegredoTotp));
    assert.equal(amostras.size, 50);
  });

  it("monta URI otpauth legivel por aplicativo autenticador", () => {
    const uri = uriTotp("GEZDGNBVGY3TQOJQ", "adv@hrs.adv.br");
    assert.match(uri, /^otpauth:\/\/totp\//);
    assert.match(uri, /secret=GEZDGNBVGY3TQOJQ/);
    assert.match(uri, /issuer=HRS\+Advocacia/);
    assert.match(uri, /digits=6/);
    assert.match(uri, /period=30/);
  });
});

describe("codigos de backup", () => {
  it("gera a quantidade pedida, todos distintos", () => {
    const codigos = gerarCodigosBackup(8);
    assert.equal(codigos.length, 8);
    assert.equal(new Set(codigos).size, 8);
  });

  it("usa formato legivel para transcricao manual", () => {
    for (const codigo of gerarCodigosBackup(5)) {
      assert.match(codigo, /^[0-9A-F]{5}-[0-9A-F]{5}$/);
    }
  });
});
