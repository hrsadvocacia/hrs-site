import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  consolidar,
  gerarParcelas,
  reguaCobranca,
  situacaoParcela,
  validarModalidade,
} from "./regras.ts";
import { deDecimal, formatarBRL, formatarCentavos, paraCentavos, paraDecimal } from "./dinheiro.ts";

describe("dinheiro em centavos", () => {
  it("interpreta formatos brasileiros e internacionais", () => {
    assert.equal(paraCentavos("1.234,56"), 123456);
    assert.equal(paraCentavos("1234,56"), 123456);
    assert.equal(paraCentavos("1234.56"), 123456);
    assert.equal(paraCentavos("1,234.56"), 123456);
    assert.equal(paraCentavos("1.234"), 123400);
    assert.equal(paraCentavos("1234,5"), 123450);
    assert.equal(paraCentavos("R$ 10"), 1000);
    assert.equal(paraCentavos(0.1 + 0.2), 30);
  });
  it("recusa lixo", () => {
    assert.throws(() => paraCentavos("abc"));
    assert.throws(() => paraCentavos("1,2,3"));
    assert.throws(() => paraCentavos(""));
    assert.throws(() => paraCentavos("12,345"));
  });
  it("formata e converte para o decimal do banco", () => {
    assert.equal(formatarCentavos(123456), "1.234,56");
    assert.equal(formatarCentavos(5), "0,05");
    assert.equal(formatarCentavos(-100000), "-1.000,00");
    assert.equal(formatarBRL(100), "R$ 1,00");
    assert.equal(paraDecimal(123456), "1234.56");
    assert.equal(paraDecimal(7), "0.07");
    assert.equal(deDecimal("1234.56"), 123456);
    assert.equal(deDecimal(null), 0);
  });
});

describe("validarModalidade", () => {
  it("FIXO exige valor fixo e recusa os demais", () => {
    assert.deepEqual(validarModalidade("FIXO", { valorFixo: 500000 }), []);
    const erros = validarModalidade("FIXO", { percentualExito: 30 });
    assert.ok(erros.some((e) => e.includes("Valor fixo é obrigatório")));
    assert.ok(erros.some((e) => e.includes("Percentual de êxito não se aplica")));
  });
  it("EXITO exige percentual dentro de 0-100", () => {
    assert.deepEqual(validarModalidade("EXITO", { percentualExito: 30 }), []);
    assert.ok(validarModalidade("EXITO", { percentualExito: 130 }).length > 0);
    assert.ok(validarModalidade("EXITO", {}).length > 0);
  });
  it("MISTO, PRO_LABORE_MAIS_EXITO e CONSULTIVO_MENSAL", () => {
    assert.deepEqual(validarModalidade("MISTO", { valorFixo: 1, percentualExito: 20 }), []);
    assert.deepEqual(
      validarModalidade("PRO_LABORE_MAIS_EXITO", { valorProLabore: 1, percentualExito: 20 }),
      [],
    );
    assert.deepEqual(validarModalidade("CONSULTIVO_MENSAL", { valorMensal: 1 }), []);
    assert.ok(validarModalidade("CONSULTIVO_MENSAL", { valorMensal: 1, valorFixo: 2 }).length > 0);
  });
});

describe("gerarParcelas", () => {
  it("soma bate ao centavo e o resto vai para a última", () => {
    const p = gerarParcelas({ totalCentavos: 100000, quantidade: 3, primeiroVencimento: "2026-01-10" });
    assert.deepEqual(p.map((x) => x.valorCentavos), [33333, 33333, 33334]);
    assert.equal(p.reduce((s, x) => s + x.valorCentavos, 0), 100000);
    assert.deepEqual(p.map((x) => x.vencimento), ["2026-01-10", "2026-02-10", "2026-03-10"]);
  });
  it("dia 31 cai no último dia dos meses curtos e vira o ano", () => {
    const p = gerarParcelas({ totalCentavos: 400, quantidade: 4, primeiroVencimento: "2026-12-31" });
    assert.deepEqual(p.map((x) => x.vencimento), ["2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
  });
  it("recusa parâmetros absurdos", () => {
    assert.throws(() => gerarParcelas({ totalCentavos: 100, quantidade: 0, primeiroVencimento: "2026-01-01" }));
    assert.throws(() => gerarParcelas({ totalCentavos: 0, quantidade: 1, primeiroVencimento: "2026-01-01" }));
    assert.throws(() => gerarParcelas({ totalCentavos: 100, quantidade: 121, primeiroVencimento: "2026-01-01" }));
  });
});

describe("situacaoParcela", () => {
  it("deriva atraso pelo vencimento, sem depender de job", () => {
    assert.equal(situacaoParcela({ status: "A_VENCER", vencimento: "2026-03-01" }, "2026-03-02"), "EM_ATRASO");
    assert.equal(situacaoParcela({ status: "A_VENCER", vencimento: "2026-03-02" }, "2026-03-02"), "A_VENCER");
    assert.equal(situacaoParcela({ status: "PAGO", vencimento: "2026-03-01" }, "2026-03-02"), "PAGO");
  });
});

describe("consolidar — naturezas separadas, provisão fora da receita", () => {
  const lancamentos = [
    { natureza: "CONTRATUAL" as const, valorCentavos: 1000, provisao: false, recebido: true },
    { natureza: "CONTRATUAL" as const, valorCentavos: 500, provisao: false, recebido: false },
    { natureza: "SUCUMBENCIA" as const, valorCentavos: 300, provisao: false, recebido: true },
    { natureza: "CONTRATUAL_DESTACADO" as const, valorCentavos: 700, provisao: false, recebido: false },
    { natureza: "CONTRATUAL" as const, valorCentavos: 9000, provisao: true, recebido: false },
    // Provisão marcada como recebida por engano: continua sendo provisão.
    { natureza: "SUCUMBENCIA" as const, valorCentavos: 8000, provisao: true, recebido: true },
  ];
  const c = consolidar(lancamentos);

  it("cada natureza fica em sua própria linha", () => {
    assert.equal(c.CONTRATUAL.realizadoCentavos, 1000);
    assert.equal(c.CONTRATUAL.aReceberCentavos, 500);
    assert.equal(c.SUCUMBENCIA.realizadoCentavos, 300);
    assert.equal(c.CONTRATUAL_DESTACADO.aReceberCentavos, 700);
    assert.equal(c.CONTRATUAL_DESTACADO.realizadoCentavos, 0);
  });
  it("provisão nunca entra em realizado nem em a receber", () => {
    assert.equal(c.CONTRATUAL.provisionadoCentavos, 9000);
    assert.equal(c.SUCUMBENCIA.provisionadoCentavos, 8000);
    assert.equal(c.SUCUMBENCIA.realizadoCentavos, 300);
    const realizadoTotal = Object.values(c).reduce((s, n) => s + n.realizadoCentavos, 0);
    assert.equal(realizadoTotal, 1300);
  });
  it("não existe 'total geral' no consolidado: a soma cega é impossível por acidente", () => {
    assert.deepEqual(Object.keys(c).sort(), ["CONTRATUAL", "CONTRATUAL_DESTACADO", "SUCUMBENCIA"]);
    for (const n of Object.values(c)) {
      assert.deepEqual(Object.keys(n).sort(), ["aReceberCentavos", "provisionadoCentavos", "quantidade", "realizadoCentavos"]);
    }
  });
});

describe("reguaCobranca", () => {
  const hoje = "2026-06-15";
  const parcelas = [
    { id: "a", status: "A_VENCER" as const, vencimento: "2026-06-18" },
    { id: "b", status: "A_VENCER" as const, vencimento: "2026-06-15" },
    { id: "c", status: "A_VENCER" as const, vencimento: "2026-06-11" },
    { id: "d", status: "A_VENCER" as const, vencimento: "2026-06-01" },
    { id: "e", status: "A_VENCER" as const, vencimento: "2026-04-01" },
    { id: "f", status: "A_VENCER" as const, vencimento: "2026-07-30" },
    { id: "g", status: "PAGO" as const, vencimento: "2026-06-01" },
    { id: "h", status: "A_VENCER" as const, vencimento: "2026-06-14" },
  ];
  const regua = reguaCobranca(parcelas, hoje);
  it("classifica pelo marco e ordena do mais atrasado ao mais distante", () => {
    assert.deepEqual(
      regua.map((i) => [i.parcela.id, i.marco]),
      [["e", "ATRASO_D30"], ["d", "ATRASO_D10"], ["c", "ATRASO_D3"], ["b", "VENCE_HOJE"], ["a", "LEMBRETE_D5"]],
    );
  });
  it("parcela paga, distante ou atrasada há menos de 3 dias não entra", () => {
    const ids = regua.map((i) => i.parcela.id);
    assert.ok(!ids.includes("g"));
    assert.ok(!ids.includes("f"));
    assert.ok(!ids.includes("h"));
  });
});

describe("porExtenso", () => {
  it("cobre os casos do recibo", async () => {
    const { porExtenso } = await import("./dinheiro.ts");
    assert.equal(porExtenso(100), "um real");
    assert.equal(porExtenso(150), "um real e cinquenta centavos");
    assert.equal(porExtenso(1), "um centavo");
    assert.equal(porExtenso(10000), "cem reais");
    assert.equal(porExtenso(123456), "mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
    assert.equal(porExtenso(100000), "mil reais");
    assert.equal(porExtenso(210000), "dois mil e cem reais");
    assert.equal(porExtenso(200500), "dois mil e cinco reais");
    assert.equal(porExtenso(350000000), "três milhões e quinhentos mil reais");
    assert.equal(porExtenso(100000000), "um milhão de reais");
    assert.equal(porExtenso(0), "zero reais");
  });
});
