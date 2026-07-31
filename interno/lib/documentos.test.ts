import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analisarCnj,
  calcularDigitoCnj,
  cnjValido,
  formatarCpfCnpj,
  validarCnpj,
  validarCpf,
  validarCpfCnpj,
} from "./documentos.ts";

describe("CPF", () => {
  it("aceita CPF valido com e sem mascara", () => {
    assert.equal(validarCpf("529.982.247-25"), true);
    assert.equal(validarCpf("52998224725"), true);
  });

  it("recusa CPF com digito verificador errado", () => {
    assert.equal(validarCpf("529.982.247-26"), false);
    assert.equal(validarCpf("11144477736"), false);
  });

  it("recusa sequencias repetidas, que passam na aritmetica mas nao sao CPF", () => {
    for (const d of "0123456789") {
      assert.equal(validarCpf(d.repeat(11)), false, `recusar ${d.repeat(11)}`);
    }
  });

  it("recusa tamanho incorreto", () => {
    assert.equal(validarCpf("5299822472"), false);
    assert.equal(validarCpf("529982247251"), false);
    assert.equal(validarCpf(""), false);
  });

  it("aceita CPF cujo digito verificador e zero (resto 10)", () => {
    // Caso classico de borda: resto 10 deve virar digito 0, nao 10.
    assert.equal(validarCpf("15350946056"), true);
  });
});

describe("CNPJ", () => {
  it("aceita CNPJ valido com e sem mascara", () => {
    assert.equal(validarCnpj("11.222.333/0001-81"), true);
    assert.equal(validarCnpj("11222333000181"), true);
  });

  it("recusa CNPJ com digito verificador errado", () => {
    assert.equal(validarCnpj("11222333000182"), false);
  });

  it("recusa sequencias repetidas e tamanho incorreto", () => {
    assert.equal(validarCnpj("11111111111111"), false);
    assert.equal(validarCnpj("1122233300018"), false);
  });
});

describe("validarCpfCnpj", () => {
  it("decide pelo tamanho", () => {
    assert.equal(validarCpfCnpj("529.982.247-25"), true);
    assert.equal(validarCpfCnpj("11.222.333/0001-81"), true);
    assert.equal(validarCpfCnpj("123"), false);
  });
});

describe("formatarCpfCnpj", () => {
  it("aplica a mascara certa para cada tamanho", () => {
    assert.equal(formatarCpfCnpj("52998224725"), "529.982.247-25");
    assert.equal(formatarCpfCnpj("11222333000181"), "11.222.333/0001-81");
    assert.equal(formatarCpfCnpj("abc"), "abc");
  });
});

describe("digito verificador CNJ (Res. CNJ 65/2008, modulo 97 base 10)", () => {
  // Vetores conferidos de forma independente, com aritmetica de precisao
  // arbitraria: DD = 98 - ((NNNNNNN AAAA J TR OOOO 00) mod 97).
  // O numero tem 20 digitos e estoura o inteiro seguro do JavaScript, entao a
  // implementacao reduz digito a digito; estes casos provam a equivalencia.
  const vetores: ReadonlyArray<
    readonly [string, string, string, string, string, string]
  > = [
    ["0010123", "2024", "5", "18", "0011", "61"],
    ["0001234", "2023", "5", "22", "0002", "71"],
    ["0005678", "2025", "5", "16", "0004", "41"],
    ["0100200", "2022", "8", "09", "0051", "64"],
    ["0000111", "2021", "4", "01", "3400", "66"],
    ["1000000", "2020", "3", "00", "0000", "28"],
  ];

  for (const [seq, ano, seg, trib, orig, esperado] of vetores) {
    it(`${seq}-${esperado}.${ano}.${seg}.${trib}.${orig}`, () => {
      assert.equal(calcularDigitoCnj(seq, ano, seg, trib, orig), esperado);
    });
  }
});

describe("analisarCnj", () => {
  it("faz o parse dos campos do numero unico", () => {
    const cnj = analisarCnj("0010123-61.2024.5.18.0011");
    assert.ok(cnj, "numero deveria ser valido");
    assert.equal(cnj.sequencial, "0010123");
    assert.equal(cnj.digito, "61");
    assert.equal(cnj.ano, 2024);
    assert.equal(cnj.segmento, "5"); // Justica do Trabalho
    assert.equal(cnj.tribunal, "18"); // TRT-18
    assert.equal(cnj.origem, "0011");
    assert.equal(cnj.digitos, "00101236120245180011");
    assert.equal(cnj.formatado, "0010123-61.2024.5.18.0011");
  });

  it("aceita entrada sem mascara e normaliza", () => {
    const cnj = analisarCnj("00101236120245180011");
    assert.equal(cnj?.formatado, "0010123-61.2024.5.18.0011");
  });

  it("recusa numero com digito verificador adulterado", () => {
    // Trocar um digito do meio invalida o DV — e exatamente o erro de digitacao
    // que nao pode entrar no cadastro em silencio.
    assert.equal(analisarCnj("0010124-61.2024.5.18.0011"), null);
    assert.equal(analisarCnj("0010123-62.2024.5.18.0011"), null);
  });

  it("recusa tamanho diferente de 20 digitos", () => {
    assert.equal(analisarCnj("0010123-61.2024.5.18.001"), null);
    assert.equal(analisarCnj(""), null);
  });

  it("recusa segmento inexistente no Judiciario", () => {
    // Segmento 0 nao existe na Res. 65/2008.
    assert.equal(cnjValido("0010123-61.2024.0.18.0011"), false);
  });

  it("recusa ano implausivel", () => {
    assert.equal(analisarCnj("0010123-61.1800.5.18.0011"), null);
  });
});
