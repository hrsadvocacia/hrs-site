import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emConformidade, exigirConformidade, normalizar, TextoVedadoError, validarTexto } from "./compliance.ts";
import { extrairVariaveis, renderizar, VariavelAusenteError, variaveisIndevidas } from "./variaveis.ts";

const tipos = (t: string) => validarTexto(t).map((v) => v.tipo);

describe("normalizar", () => {
  it("remove acento e caixa", () => {
    assert.equal(normalizar("  Garantimos   o ÊXITO! "), "garantimos o exito!");
  });
});

describe("textos em conformidade (não podem ser barrados)", () => {
  const permitidos = [
    "Prezado(a) {{nome}}, recebemos o documento {{documento}} em {{data_recebimento}}. Obrigado.",
    "Olá {{primeiro_nome}}, sua audiência no processo {{processo}} foi designada para {{data_audiencia}} às {{hora_audiencia}}, em {{local}}. {{orientacoes}}",
    "Houve movimentação no seu processo {{processo}} em {{data_movimentacao}}: {{resumo_movimentacao}}. Qualquer dúvida, estamos à disposição.",
    "Convidamos você para uma reunião em {{data_reuniao}} às {{hora_reuniao}}, em {{local}}, para tratar de {{assunto}}.",
    "Lembramos que a parcela {{numero_parcela}} do contrato de honorários, no valor de {{valor}}, vence em {{vencimento}}. Forma de pagamento: {{forma_pagamento}}.",
    "O processo segue em andamento. Não há previsão de julgamento; avisaremos a cada movimentação relevante.",
    "A perícia foi marcada. Leve seus documentos médicos originais.",
    "O advogado responsável é {{advogado}}. Telefone do escritório: {{telefone_escritorio}}.",
    "Sua audiência será realizada em 15 de outubro de 2026.",
    "Chegamos ao fórum às 8h. A audiência durou duas horas.",
    "Documento recebido e juntado aos autos.",
  ];
  for (const t of permitidos) {
    it(`aceita: ${t.slice(0, 50)}...`, () => {
      assert.deepEqual(validarTexto(t), [], JSON.stringify(validarTexto(t)));
    });
  }
});

describe("promessa de resultado", () => {
  const vedados = [
    "Garantimos o êxito da sua causa.",
    "Você vai ganhar essa ação.",
    "Temos certeza de que a causa será procedente.",
    "É ganho de causa certo.",
    "SUCESSO GARANTIDO!",
    "Existem grandes chances de êxito.",
    "Há 90% de chance de vitória.",
    "Provavelmente o juiz vai deferir o benefício.",
    "O resultado esperado é favorável.",
    "O pedido vai ser deferido.",
    "Com certeza o INSS vai reconhecer o seu direito.",
    "A vitória está garantida.",
  ];
  for (const t of vedados) {
    it(`barra: ${t}`, () => {
      assert.ok(tipos(t).includes("PROMESSA_RESULTADO"), JSON.stringify(validarTexto(t)));
    });
  }
});

describe("valor certo", () => {
  const vedados = [
    "Você vai receber cerca de R$ 50.000,00.",
    "O valor estimado da indenização é alto.",
    "Estimamos o valor da causa em 30 mil reais.",
    "Você deve receber aproximadamente 20 mil reais.",
    "Receberá R$ 3.000 de atrasados.",
    "A quantia prevista é de 15.000,00 reais.",
    "Pelo menos R$ 10 mil de indenização.",
    "Nossa previsão de recebimento é boa.",
  ];
  for (const t of vedados) {
    it(`barra: ${t}`, () => {
      assert.ok(tipos(t).includes("VALOR_CERTO"), JSON.stringify(validarTexto(t)));
    });
  }
  it("valor fixo em template é barrado mesmo em cobrança — o valor da parcela é variável", () => {
    assert.ok(tipos("A parcela de R$ 1.200,00 vence dia 10.").includes("VALOR_CERTO"));
    assert.deepEqual(tipos("A parcela de {{valor}} vence em {{vencimento}}."), []);
  });
});

describe("prazo garantido", () => {
  const vedados = [
    "Prazo garantido de 60 dias.",
    "Garantimos a conclusão rápida. Garantimos o prazo.",
    "O processo será concluído em 6 meses.",
    "Sua aposentadoria sai em até 90 dias.",
    "O benefício será liberado dentro de 30 dias.",
    "Resolvemos tudo em poucas semanas.",
    "Previsão de conclusão: dezembro.",
    "Pagamento previsto para o próximo mês.",
    "O alvará será pago em 2 meses.",
    "Você vai receber cerca de R$ 50.000,00 em até 6 meses.",
    "O valor será liberado, após o trânsito em julgado, em 90 dias.",
  ];
  for (const t of vedados) {
    it(`barra: ${t}`, () => {
      assert.ok(tipos(t).includes("PRAZO_GARANTIDO"), JSON.stringify(validarTexto(t)));
    });
  }
  it("não confunde data de audiência com prazo de conclusão", () => {
    assert.deepEqual(tipos("A audiência será em 12 de março."), []);
    assert.deepEqual(tipos("Vencimento em 5 dias úteis."), []);
  });
});

describe("captação indevida", () => {
  const vedados = [
    "Aproveite a promoção de honorários!",
    "Indique um amigo e ganhe desconto.",
    "Somos o melhor escritório da região.",
    "Especialistas em INSS.",
    "Consulta grátis por tempo limitado.",
  ];
  for (const t of vedados) {
    it(`barra: ${t}`, () => {
      assert.ok(tipos(t).includes("CAPTACAO_INDEVIDA"), JSON.stringify(validarTexto(t)));
    });
  }
});

describe("resultado e erro", () => {
  it("traz trecho e explicação, sem duplicar", () => {
    const v = validarTexto("Garantimos o êxito. Garantimos o êxito.");
    assert.equal(v.length, 1);
    assert.equal(v[0]!.trecho, "garantimos o exito");
    assert.ok(v[0]!.explicacao.includes("205/2021"));
  });
  it("exigirConformidade lança TextoVedadoError com as violações", () => {
    assert.throws(() => exigirConformidade("Você vai ganhar."), TextoVedadoError);
    assert.ok(emConformidade("Recebemos seu documento."));
  });
});

describe("variáveis", () => {
  it("extrai e valida contra o catálogo fechado da categoria", () => {
    assert.deepEqual(extrairVariaveis("Olá {{nome}}, {{ processo }} e {{nome}}"), ["nome", "processo"]);
    assert.deepEqual(variaveisIndevidas("Olá {{nome}}, {{valor}}", "COBRANCA_PARCELA"), []);
    const ind = variaveisIndevidas("Você vai receber {{valor_estimado}}", "MOVIMENTACAO_PROCESSO");
    assert.equal(ind.length, 1);
    assert.equal(ind[0]!.trecho, "{{valor_estimado}}");
  });
  it("renderiza e recusa variável sem valor", () => {
    assert.equal(renderizar("Olá {{nome}}!", { nome: "Ana" }), "Olá Ana!");
    assert.throws(() => renderizar("Olá {{nome}}!", {}), VariavelAusenteError);
    assert.throws(() => renderizar("Olá {{nome}}!", { nome: "  " }), VariavelAusenteError);
  });
});

describe("negação de previsão é a frase correta", () => {
  it("aceita 'não há previsão' e 'sem estimativa'", () => {
    assert.deepEqual(tipos("Não há previsão de julgamento."), []);
    assert.deepEqual(tipos("Ainda não temos previsão de pagamento."), []);
    assert.deepEqual(tipos("Sem estimativa de valor neste momento."), []);
  });
  it("mas a negação não salva promessa de resultado", () => {
    assert.ok(tipos("Não se preocupe: você vai ganhar.").includes("PROMESSA_RESULTADO"));
    assert.ok(tipos("Não é impossível, temos certeza de que vai vencer.").includes("PROMESSA_RESULTADO"));
  });
});

describe("o trecho citado é legível", () => {
  it("cita o valor inteiro, não o primeiro dígito", () => {
    const v = validarTexto("Você vai receber R$ 50.000,00.");
    const moeda = v.find((x) => x.trecho.startsWith("r$"));
    assert.equal(moeda?.trecho, "r$ 50.000,00");
  });
});
