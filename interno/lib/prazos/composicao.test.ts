import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  comporEntradas,
  identificarCalendario,
  montarCalendario,
  type DiaTribunalBruto,
  type FeriadoGeralBruto,
} from "./composicao.ts";
import { temExpediente } from "./calendario.ts";
import { calcularPrazo } from "./motor.ts";

const GOIANIA = { municipio: "Goiânia", uf: "GO", orgaoJulgadorId: "org-goiania" };
const ANAPOLIS = { municipio: "Anápolis", uf: "GO", orgaoJulgadorId: "org-anapolis" };
const TERESINA = { municipio: "Teresina", uf: "PI", orgaoJulgadorId: "org-teresina" };

const NACIONAL: FeriadoGeralBruto = {
  data: "2026-09-07",
  nome: "Independência do Brasil",
  abrangencia: "NACIONAL",
  uf: null,
  municipio: null,
  suspendeExpediente: true,
  fonte: "Lei 662/1949",
};

const ESTADUAL_GO: FeriadoGeralBruto = {
  data: "2026-07-26",
  nome: "Feriado estadual de Goiás",
  abrangencia: "ESTADUAL",
  uf: "GO",
  municipio: null,
  suspendeExpediente: true,
  fonte: "Lei estadual (fixture)",
};

const MUNICIPAL_GOIANIA: FeriadoGeralBruto = {
  // Quarta-feira: precisa cair em dia util para o teste distinguir alguma
  // coisa. Feriado em fim de semana nao altera contagem em dias uteis.
  data: "2026-05-27",
  nome: "Padroeira de Goiânia",
  abrangencia: "MUNICIPAL",
  uf: "GO",
  municipio: "Goiânia",
  suspendeExpediente: true,
  fonte: "Lei municipal (fixture)",
};

describe("feriado municipal alcança só o município do órgão julgador", () => {
  it("aplica em Goiânia", () => {
    const e = comporEntradas(GOIANIA, [MUNICIPAL_GOIANIA], []);
    assert.equal(e.length, 1);
    assert.equal(e[0]!.data, "2026-05-27");
  });

  it("NÃO aplica em Anápolis, ainda que no mesmo estado e no mesmo tribunal", () => {
    // O TRT-18 cobre Goiás inteiro. Um processo em Anápolis não para no
    // feriado de Goiânia — aplicar ali atrasaria a data fatal.
    assert.deepEqual(comporEntradas(ANAPOLIS, [MUNICIPAL_GOIANIA], []), []);
  });

  it("compara município ignorando acento e caixa", () => {
    const semAcento = { ...GOIANIA, municipio: "GOIANIA" };
    assert.equal(comporEntradas(semAcento, [MUNICIPAL_GOIANIA], []).length, 1);
  });
});

describe("feriado estadual alcança só a UF do órgão", () => {
  it("aplica em Goiás", () => {
    assert.equal(comporEntradas(GOIANIA, [ESTADUAL_GO], []).length, 1);
  });

  it("não aplica no Piauí", () => {
    assert.deepEqual(comporEntradas(TERESINA, [ESTADUAL_GO], []), []);
  });
});

describe("feriado nacional alcança todo mundo", () => {
  it("aplica nas três praças", () => {
    for (const local of [GOIANIA, ANAPOLIS, TERESINA]) {
      assert.equal(comporEntradas(local, [NACIONAL], []).length, 1, local.municipio!);
    }
  });
});

describe("portaria de tribunal restrita a um órgão", () => {
  const suspensaoSoEmGoiania: DiaTribunalBruto = {
    data: "2026-03-09",
    descricao: "Suspensão de expediente nas Varas de Goiânia",
    suspendeExpediente: true,
    fonte: "Portaria 12/2026 — TRT-18",
    orgaoJulgadorId: "org-goiania",
  };

  it("alcança o órgão indicado", () => {
    const e = comporEntradas(GOIANIA, [], [suspensaoSoEmGoiania]);
    assert.equal(e.length, 1);
    assert.match(e[0]!.fonte, /Portaria 12\/2026/);
  });

  it("NÃO alcança outro órgão do mesmo tribunal", () => {
    // Aplicar a todo o tribunal uma suspensão de uma vara só ATRASA a data
    // fatal, que é a direção de erro que perde prazo.
    assert.deepEqual(comporEntradas(ANAPOLIS, [], [suspensaoSoEmGoiania]), []);
  });

  it("portaria sem órgão indicado alcança todo o tribunal", () => {
    const geral: DiaTribunalBruto = { ...suspensaoSoEmGoiania, orgaoJulgadorId: null };
    assert.equal(comporEntradas(GOIANIA, [], [geral]).length, 1);
    assert.equal(comporEntradas(ANAPOLIS, [], [geral]).length, 1);
  });
});

describe("precedência: a fonte exibida é a mais específica", () => {
  const mesmaData = "2026-06-15";

  it("portaria do órgão vence portaria geral, que vence feriado nacional", () => {
    const entradas = comporEntradas(
      GOIANIA,
      [
        {
          data: mesmaData,
          nome: "Feriado nacional",
          abrangencia: "NACIONAL",
          uf: null,
          municipio: null,
          suspendeExpediente: true,
          fonte: "Lei 662/1949",
        },
      ],
      [
        {
          data: mesmaData,
          descricao: "Suspensão geral",
          suspendeExpediente: true,
          fonte: "Portaria geral",
          orgaoJulgadorId: null,
        },
        {
          data: mesmaData,
          descricao: "Suspensão da vara",
          suspendeExpediente: true,
          fonte: "Portaria da vara",
          orgaoJulgadorId: "org-goiania",
        },
      ],
    );
    // criarCalendario mantém a PRIMEIRA de cada data.
    assert.equal(entradas[0]!.fonte, "Portaria da vara");

    const cal = montarCalendario("teste", GOIANIA, [], [
      {
        data: mesmaData,
        descricao: "Suspensão da vara",
        suspendeExpediente: true,
        fonte: "Portaria da vara",
        orgaoJulgadorId: "org-goiania",
      },
    ]);
    assert.equal(cal.diaSemExpediente(mesmaData)?.fonte, "Portaria da vara");
  });
});

describe("suspendeExpediente = false não afeta a contagem", () => {
  it("ponto facultativo sem suspensão continua sendo dia útil", () => {
    const cal = montarCalendario("teste", GOIANIA, [], [
      {
        data: "2026-06-04",
        descricao: "Corpus Christi",
        suspendeExpediente: false,
        fonte: "Não houve suspensão — expediente normal",
        orgaoJulgadorId: null,
      },
    ]);
    assert.equal(temExpediente(cal, "2026-06-04"), true);
  });
});

describe("aceita Date e string, como vêm do Prisma", () => {
  it("normaliza os dois formatos para AAAA-MM-DD", () => {
    const comDate = comporEntradas(
      GOIANIA,
      [{ ...NACIONAL, data: new Date("2026-09-07T00:00:00Z") }],
      [],
    );
    assert.equal(comDate[0]!.data, "2026-09-07");
  });
});

describe("integração com o motor", () => {
  it("o mesmo prazo dá datas diferentes em Goiânia e em Anápolis", () => {
    const feriados = [MUNICIPAL_GOIANIA];
    const calGoiania = montarCalendario("TRT18-Goiânia-2026-v1", GOIANIA, feriados, []);
    const calAnapolis = montarCalendario("TRT18-Anápolis-2026-v1", ANAPOLIS, feriados, []);

    const entrada = {
      dataPublicacao: "2026-05-18",
      prazoDias: 8,
      regime: "DIAS_UTEIS_TRABALHISTA" as const,
    };
    const goiania = calcularPrazo({ ...entrada, calendario: calGoiania });
    const anapolis = calcularPrazo({ ...entrada, calendario: calAnapolis });

    assert.equal(anapolis.dataFatal, "2026-05-28");
    assert.equal(goiania.dataFatal, "2026-05-29", "o feriado municipal adia um dia util");
    assert.ok(goiania.dataFatal > anapolis.dataFatal);
    assert.equal(
      goiania.feriadosAplicados.some((f) => f.origem === "MUNICIPAL"),
      true,
    );
    assert.equal(anapolis.feriadosAplicados.length, 0);
  });

  it("a identificação do calendário viaja para o resultado", () => {
    const cal = montarCalendario("TRT18-Goiânia-2026-v1", GOIANIA, [], []);
    const r = calcularPrazo({
      dataPublicacao: "2026-05-18",
      prazoDias: 5,
      regime: "DIAS_UTEIS_TRABALHISTA",
      calendario: cal,
    });
    assert.equal(r.calendarioIdentificacao, "TRT18-Goiânia-2026-v1");
  });
});

describe("identificarCalendario", () => {
  it("monta identificação estável e legível", () => {
    assert.equal(identificarCalendario("TRT18", 2026, 1, "Goiânia"), "TRT18-Goiânia-2026-v1");
    assert.equal(identificarCalendario("TST", 2026, 3, null), "TST-2026-v3");
    assert.equal(identificarCalendario("TRT16", 2027, 1, "São Luís"), "TRT16-SãoLuís-2027-v1");
  });
});
