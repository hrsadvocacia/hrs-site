import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarCalendario, type EntradaCalendario } from "./calendario.ts";
import { calcularPrazo, VERSAO_MOTOR } from "./motor.ts";

/**
 * Todos os resultados esperados deste arquivo foram calculados por uma
 * implementacao independente, em Python, antes de rodar o motor — e nao
 * extraidos da saida dele. Teste que confirma o proprio codigo nao prova nada.
 */

const semFeriados = criarCalendario("teste-vazio", []);

function calendario(nome: string, entradas: EntradaCalendario[]) {
  return criarCalendario(nome, entradas);
}

const TIRADENTES_2026: EntradaCalendario = {
  data: "2026-04-21",
  nome: "Tiradentes",
  origem: "NACIONAL",
  fonte: "Lei 662/1949",
};

// =============================================================================
// CASO 1 — Publicacao nao e disponibilizacao
// =============================================================================
describe("publicacao e o primeiro dia util seguinte a disponibilizacao", () => {
  it("desloca a publicacao em um dia util (Lei 11.419/2006, art. 4o, 3o)", () => {
    // Disponibilizado terca 03/03/2026 -> publicado quarta 04/03 ->
    // contagem inicia quinta 05/03 -> 8o dia util em segunda 16/03.
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(r.dataPublicacaoConsiderada, "2026-03-04");
    assert.equal(r.dataInicioContagem, "2026-03-05");
    assert.equal(r.dataFatal, "2026-03-16");
    assert.equal(r.diasUteisContados, 8);
  });

  it("tratar disponibilizacao COMO publicacao encurtaria o prazo", () => {
    // Prova de que a distincao importa: e o erro que faz perder prazo.
    const correto = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    const errado = calcularPrazo({
      dataPublicacao: "2026-03-03",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.notEqual(correto.dataFatal, errado.dataFatal);
    assert.ok(correto.dataFatal > errado.dataFatal);
  });

  it("aceita ciencia direta quando nao houve diario (intimacao pessoal)", () => {
    const r = calcularPrazo({
      dataPublicacao: "2026-03-04",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(r.dataPublicacaoConsiderada, "2026-03-04");
    assert.equal(r.dataFatal, "2026-03-16");
  });

  it("havendo disponibilizacao, a publicacao informada e ignorada e isso e dito", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      dataPublicacao: "2026-03-03",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(r.dataPublicacaoConsiderada, "2026-03-04");
    assert.ok(r.premissas.some((p) => p.includes("ignorada")));
  });
});

// =============================================================================
// CASO 2 — Disponibilizacao em vespera de feriado
// =============================================================================
describe("disponibilizacao na vespera de feriado", () => {
  it("empurra a publicacao para depois do feriado", () => {
    // Disponibilizado segunda 20/04/2026; terca 21/04 e Tiradentes.
    // Publicacao vai para quarta 22/04, inicio quinta 23/04, fatal 04/05.
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-04-20",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("nacional", [TIRADENTES_2026]),
    });
    assert.equal(r.dataPublicacaoConsiderada, "2026-04-22");
    assert.equal(r.dataInicioContagem, "2026-04-23");
    assert.equal(r.dataFatal, "2026-05-04");
  });

  it("disponibilizacao na sexta publica na segunda", () => {
    // Sexta 06/03/2026 -> proximo dia util e segunda 09/03.
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-06",
      prazoDias: 5,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(r.dataPublicacaoConsiderada, "2026-03-09");
    assert.equal(r.dataInicioContagem, "2026-03-10");
  });
});

// =============================================================================
// CASO 3 — Prazo de 5 dias iniciando numa sexta, com segunda de ponto facultativo
// =============================================================================
describe("prazo de 5 dias iniciando numa sexta, segunda de ponto facultativo", () => {
  const publicacao = "2026-03-05"; // quinta -> inicio sexta 06/03
  const segunda = "2026-03-09";

  it("ponto facultativo COM suspensao de expediente nao conta", () => {
    const r = calcularPrazo({
      dataPublicacao: publicacao,
      prazoDias: 5,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("com-portaria", [
        {
          data: segunda,
          nome: "Ponto facultativo",
          origem: "TRIBUNAL",
          fonte: "Portaria 10/2026 — TRT-18",
          suspendeExpediente: true,
        },
      ]),
    });
    assert.equal(r.dataInicioContagem, "2026-03-06");
    assert.equal(r.dataFatal, "2026-03-13");
    assert.ok(
      r.feriadosAplicados.some((f) => f.data === segunda),
      "a segunda suspensa precisa aparecer nos feriados aplicados",
    );
  });

  it("ponto facultativo SEM suspensao de expediente conta como dia util", () => {
    // Diferenca de um dia inteiro na data fatal. Quem decide e o ato do
    // tribunal — tratar ponto facultativo como feriado automatico faria o
    // motor contar um dia util a menos sem base legal.
    const r = calcularPrazo({
      dataPublicacao: publicacao,
      prazoDias: 5,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("sem-portaria", [
        {
          data: segunda,
          nome: "Ponto facultativo",
          origem: "TRIBUNAL",
          fonte: "Nao houve suspensao de expediente",
          suspendeExpediente: false,
        },
      ]),
    });
    assert.equal(r.dataFatal, "2026-03-12");
  });

  it("a decisao sobre o ponto facultativo muda a data fatal", () => {
    const comSuspensao = calcularPrazo({
      dataPublicacao: publicacao,
      prazoDias: 5,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("a", [
        { data: segunda, nome: "PF", origem: "TRIBUNAL", fonte: "Portaria", suspendeExpediente: true },
      ]),
    });
    const semSuspensao = calcularPrazo({
      dataPublicacao: publicacao,
      prazoDias: 5,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(comSuspensao.dataFatal, "2026-03-13");
    assert.equal(semSuspensao.dataFatal, "2026-03-12");
  });
});

// =============================================================================
// CASO 4 — Feriado municipal em uma so unidade
// =============================================================================
describe("feriado municipal alcanca so a praca do orgao julgador", () => {
  // Mesmo prazo, mesmo tribunal, orgaos em municipios diferentes.
  const publicacao = "2026-05-05";
  const feriadoGoiania: EntradaCalendario = {
    data: "2026-05-11",
    nome: "Feriado municipal de Goiania",
    origem: "MUNICIPAL",
    fonte: "Lei municipal (fixture de teste)",
  };

  it("a unidade com o feriado tem data fatal posterior", () => {
    const goiania = calcularPrazo({
      dataPublicacao: publicacao,
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("TRT18-Goiania-2026", [feriadoGoiania]),
    });
    const teresina = calcularPrazo({
      dataPublicacao: publicacao,
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("TRT22-Teresina-2026", []),
    });

    assert.equal(goiania.dataInicioContagem, "2026-05-06");
    assert.equal(teresina.dataInicioContagem, "2026-05-06");
    assert.equal(goiania.dataFatal, "2026-05-18");
    assert.equal(teresina.dataFatal, "2026-05-15");
    assert.notEqual(goiania.dataFatal, teresina.dataFatal);
  });

  it("o feriado municipal aparece na saida, com a fonte", () => {
    const r = calcularPrazo({
      dataPublicacao: publicacao,
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("TRT18-Goiania-2026", [feriadoGoiania]),
    });
    const aplicado = r.feriadosAplicados.find((f) => f.data === "2026-05-11");
    assert.ok(aplicado, "o feriado precisa constar dos insumos do calculo");
    assert.equal(aplicado.origem, "MUNICIPAL");
    assert.match(aplicado.fonte, /Lei municipal/);
  });

  it("o calendario usado fica identificado no resultado", () => {
    // Sem isso, um recalculo futuro nao saberia qual calendario produziu a data.
    const r = calcularPrazo({
      dataPublicacao: publicacao,
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("TRT18-Goiania-2026", [feriadoGoiania]),
    });
    assert.equal(r.calendarioIdentificacao, "TRT18-Goiania-2026");
    assert.equal(r.versaoMotor, VERSAO_MOTOR);
  });
});

// =============================================================================
// CASO 5 — Virada de ano no recesso
// =============================================================================
describe("recesso forense com virada de ano", () => {
  it("suspende o curso e retoma preservando os dias ja decorridos", () => {
    // Publicacao quinta 10/12/2026, inicio sexta 11/12, 8 dias uteis.
    // Correm 6 dias ate sexta 18/12; o recesso suspende de 20/12 a 20/01;
    // retoma em 21/01/2027 com o 7o dia e vence em 22/01/2027.
    const r = calcularPrazo({
      dataPublicacao: "2026-12-10",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(r.dataInicioContagem, "2026-12-11");
    assert.equal(r.dataFatal, "2027-01-22");
    assert.equal(r.diasUteisContados, 8);
  });

  it("NAO reinicia a contagem: recomecar do zero daria data diferente", () => {
    // Se o recesso zerasse o prazo, os 8 dias correriam inteiros a partir de
    // 21/01/2027 e venceriam em 01/02/2027. Preservando os 6 dias ja
    // decorridos, vence em 22/01. A diferenca e de sete dias corridos.
    const atravessando = calcularPrazo({
      dataPublicacao: "2026-12-10",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    const comecandoDepois = calcularPrazo({
      dataPublicacao: "2026-12-28",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(atravessando.dataFatal, "2027-01-22");
    assert.equal(comecandoDepois.dataFatal, "2027-02-01");
    assert.notEqual(atravessando.dataFatal, comecandoDepois.dataFatal);
  });

  it("termo inicial dentro do recesso e adiado para depois de 20/01", () => {
    // Publicacao segunda 28/12/2026: o inicio cairia em 29/12, dentro do
    // recesso. O prazo so comeca a correr em 21/01/2027.
    const r = calcularPrazo({
      dataPublicacao: "2026-12-28",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(r.dataInicioContagem, "2027-01-21");
    assert.equal(r.dataFatal, "2027-02-01");
    assert.ok(r.premissas.some((p) => p.includes("recesso")));
  });

  it("o recesso aparece nos insumos, com o fundamento do ramo", () => {
    const trabalhista = calcularPrazo({
      dataPublicacao: "2026-12-10",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    const civel = calcularPrazo({
      dataPublicacao: "2026-12-10",
      prazoDias: 8,
      regime: "DIAS_UTEIS_CPC",
      calendario: semFeriados,
    });
    assert.match(
      trabalhista.feriadosAplicados.find((f) => f.origem === "RECESSO")!.fonte,
      /775-A/,
    );
    assert.match(
      civel.feriadosAplicados.find((f) => f.origem === "RECESSO")!.fonte,
      /220/,
    );
  });

  it("prazo que nao encosta no recesso nao registra suspensao", () => {
    const r = calcularPrazo({
      dataPublicacao: "2026-06-10",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.equal(
      r.feriadosAplicados.some((f) => f.origem === "RECESSO"),
      false,
    );
  });
});

// =============================================================================
// Dias corridos — nao suspendem no recesso
// =============================================================================
describe("dias corridos", () => {
  it("atravessa o recesso sem suspender (prazo administrativo do INSS)", () => {
    // 30 dias corridos a partir de 11/12/2026 vencem em sabado 09/01/2027,
    // prorrogado para segunda 11/01/2027.
    const r = calcularPrazo({
      dataPublicacao: "2026-12-10",
      prazoDias: 30,
      regime: "DIAS_CORRIDOS",
      calendario: semFeriados,
    });
    assert.equal(r.dataInicioContagem, "2026-12-11");
    assert.equal(r.dataFatal, "2027-01-11");
    assert.equal(r.diasUteisContados, 30);
    assert.equal(
      r.feriadosAplicados.some((f) => f.origem === "RECESSO"),
      false,
      "prazo administrativo nao se suspende no recesso forense",
    );
  });

  it("comeca no dia seguinte, sem aguardar dia util", () => {
    // Ciencia numa sexta: o prazo administrativo corre ja no sabado. Aguardar
    // a segunda produziria data fatal POSTERIOR a real — o erro perigoso.
    const r = calcularPrazo({
      dataPublicacao: "2026-03-06", // sexta
      prazoDias: 10,
      regime: "DIAS_CORRIDOS",
      calendario: semFeriados,
    });
    assert.equal(r.dataInicioContagem, "2026-03-07"); // sabado
  });

  it("prazo penal aguarda o primeiro dia util (Sumula 310 do STF)", () => {
    const r = calcularPrazo({
      dataPublicacao: "2026-03-06", // sexta
      prazoDias: 10,
      regime: "DIAS_CORRIDOS_PENAL",
      calendario: semFeriados,
    });
    assert.equal(r.dataInicioContagem, "2026-03-09"); // segunda
  });

  it("prorroga o vencimento que cai em dia sem expediente", () => {
    const r = calcularPrazo({
      dataPublicacao: "2026-03-06",
      prazoDias: 10,
      regime: "DIAS_CORRIDOS",
      calendario: semFeriados,
    });
    // 07/03 + 9 = 16/03 (segunda). Sem prorrogacao necessaria.
    assert.equal(r.dataFatal, "2026-03-16");
    const r2 = calcularPrazo({
      dataPublicacao: "2026-03-06",
      prazoDias: 8,
      regime: "DIAS_CORRIDOS",
      calendario: semFeriados,
    });
    // 07/03 + 7 = 14/03, sabado -> prorroga para segunda 16/03.
    assert.equal(r2.dataFatal, "2026-03-16");
    assert.ok(r2.premissas.some((p) => p.includes("prorrogado")));
  });
});

// =============================================================================
// A saida sempre explica a data
// =============================================================================
describe("o resultado nunca e so a data", () => {
  it("devolve todos os insumos do calculo", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-04-20",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("TRT18-2026-v1", [TIRADENTES_2026]),
    });
    assert.ok(r.dataFatal);
    assert.ok(r.dataPublicacaoConsiderada);
    assert.ok(r.dataInicioContagem);
    assert.ok(r.diasUteisContados > 0);
    assert.ok(Array.isArray(r.feriadosAplicados));
    assert.ok(r.fundamentoLegal.length > 0);
    assert.ok(r.premissas.length >= 3);
    assert.equal(r.versaoMotor, VERSAO_MOTOR);
    assert.equal(r.calendarioIdentificacao, "TRT18-2026-v1");
  });

  it("cita a norma de cada regime", () => {
    const porRegime = {
      DIAS_UTEIS_TRABALHISTA: /CLT art\. 775/,
      DIAS_UTEIS_CPC: /CPC art\. 219/,
      DIAS_CORRIDOS_PENAL: /CPP art\. 798/,
      DIAS_CORRIDOS: /9\.784/,
    } as const;
    for (const [regime, esperado] of Object.entries(porRegime)) {
      const r = calcularPrazo({
        dataPublicacao: "2026-06-10",
        prazoDias: 5,
        regime: regime as keyof typeof porRegime,
        calendario: semFeriados,
      });
      assert.match(r.fundamentoLegal, esperado, regime);
    }
  });

  it("as premissas mencionam a lei da publicacao quando houve diario", () => {
    const r = calcularPrazo({
      dataDisponibilizacao: "2026-03-03",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: semFeriados,
    });
    assert.ok(r.premissas.some((p) => p.includes("11.419/2006")));
  });

  it("os feriados aplicados vem ordenados por data", () => {
    const r = calcularPrazo({
      dataPublicacao: "2026-04-15",
      prazoDias: 20,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: calendario("varios", [
        TIRADENTES_2026,
        { data: "2026-05-01", nome: "Dia do Trabalho", origem: "NACIONAL", fonte: "Lei 662/1949" },
      ]),
    });
    const datas = r.feriadosAplicados.map((f) => f.data);
    assert.deepEqual(datas, [...datas].sort());
  });
});

// =============================================================================
// Recusas
// =============================================================================
describe("o motor recusa entrada incoerente em vez de chutar", () => {
  it("exige disponibilizacao ou publicacao", () => {
    assert.throws(
      () =>
        calcularPrazo({
          prazoDias: 8,
          regime: "DIAS_UTEIS_TRABALHISTA",
          calendario: semFeriados,
        }),
      /disponibilização ou a data de publicação/,
    );
  });

  it("recusa prazo de zero ou negativo", () => {
    for (const dias of [0, -5, 1.5]) {
      assert.throws(
        () =>
          calcularPrazo({
            dataPublicacao: "2026-03-02",
            prazoDias: dias,
            regime: "DIAS_UTEIS_TRABALHISTA",
            calendario: semFeriados,
          }),
        /maior que zero/,
        String(dias),
      );
    }
  });

  it("recusa data malformada", () => {
    assert.throws(
      () =>
        calcularPrazo({
          dataPublicacao: "02/03/2026",
          prazoDias: 8,
          regime: "DIAS_UTEIS_TRABALHISTA",
          calendario: semFeriados,
        }),
      /Data inválida/,
    );
  });

  it("quebra alto quando o calendario marca tudo sem expediente", () => {
    // Falha ruidosa e melhor que laco infinito ou data absurda.
    const calendarioQuebrado = {
      identificacao: "quebrado",
      diaSemExpediente: (data: string) => ({
        data,
        nome: "Suspensao",
        origem: "TRIBUNAL" as const,
        fonte: "calendario mal preenchido",
      }),
    };
    assert.throws(
      () =>
        calcularPrazo({
          dataPublicacao: "2026-03-02",
          prazoDias: 8,
          regime: "DIAS_UTEIS_TRABALHISTA",
          calendario: calendarioQuebrado,
        }),
      /mal preenchid/,
    );
  });
});
