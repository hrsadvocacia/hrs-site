import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extrairCnj,
  nomeConfere,
  normalizarNome,
  oabConfere,
  triar,
  type InscricaoConhecida,
  type ProcessoConhecido,
} from "./triagem.ts";
import {
  chaveDeduplicacao,
  deduplicarLote,
  hashConteudo,
  normalizarTeor,
} from "./dedup.ts";

// CNJ válido conferido em Fase 0 (dígito verificador pelo módulo 97).
const CNJ = "0010123-61.2024.5.18.0011";
const CNJ_DIGITOS = "00101236120245180011";
const CNJ_OUTRO = "0001234-71.2023.5.22.0002";

const INSCRICOES: InscricaoConhecida[] = [
  { numero: "76478", uf: "GO", nomeAdvogado: "Adrielly Sousa Oliveira" },
  { numero: "8815", uf: "PI", nomeAdvogado: "Aluísio Henrique de Holanda Filho" },
];

const PROCESSOS: ProcessoConhecido[] = [
  { id: "proc-1", numeroCnjDigitos: CNJ_DIGITOS },
];

function pub(over: Partial<Parameters<typeof triar>[0]> = {}) {
  return {
    numeroProcesso: CNJ,
    teor: "Intimação para apresentar contestação no prazo legal.",
    nomeAdvogadoCitado: "Adrielly Sousa Oliveira",
    numeroOabCitado: "76478",
    ufOabCitada: "GO",
    ...over,
  };
}

describe("extração do número CNJ", () => {
  it("lê do campo próprio, com ou sem máscara", () => {
    assert.equal(extrairCnj(pub({ numeroProcesso: CNJ })), CNJ_DIGITOS);
    assert.equal(extrairCnj(pub({ numeroProcesso: CNJ_DIGITOS })), CNJ_DIGITOS);
  });

  it("acha no teor quando o campo próprio vem vazio", () => {
    const r = extrairCnj(
      pub({
        numeroProcesso: null,
        teor: `Nos autos do processo ${CNJ}, fica intimada a parte...`,
      }),
    );
    assert.equal(r, CNJ_DIGITOS);
  });

  it("RECUSA número com dígito verificador errado", () => {
    // Casar por número malformado poderia vincular a comunicação ao processo
    // errado — e prazo no processo errado é pior que prazo órfão.
    assert.equal(extrairCnj(pub({ numeroProcesso: "0010123-99.2024.5.18.0011" })), null);
  });

  it("recusa número com tamanho errado", () => {
    assert.equal(extrairCnj(pub({ numeroProcesso: "12345", teor: "sem número" })), null);
  });

  it("devolve null quando não há número algum", () => {
    assert.equal(
      extrairCnj(pub({ numeroProcesso: null, teor: "Comunicação sem número." })),
      null,
    );
  });
});

describe("conferência da OAB citada", () => {
  it("aceita variações de grafia do número", () => {
    for (const grafia of ["76478", "76.478", "076478", "76 478"]) {
      assert.equal(oabConfere(pub({ numeroOabCitado: grafia }), INSCRICOES), true, grafia);
    }
  });

  it("recusa OAB de outra UF", () => {
    assert.equal(
      oabConfere(pub({ numeroOabCitado: "76478", ufOabCitada: "SP" }), INSCRICOES),
      false,
    );
  });

  it("recusa número desconhecido", () => {
    assert.equal(oabConfere(pub({ numeroOabCitado: "99999" }), INSCRICOES), false);
  });

  it("recusa quando a fonte não informou OAB", () => {
    assert.equal(oabConfere(pub({ numeroOabCitado: null }), INSCRICOES), false);
  });
});

describe("conferência do nome", () => {
  it("compara sem acento e sem caixa", () => {
    assert.equal(
      nomeConfere(pub({ nomeAdvogadoCitado: "ALUISIO HENRIQUE DE HOLANDA FILHO" }), INSCRICOES),
      true,
    );
    assert.equal(
      nomeConfere(pub({ nomeAdvogadoCitado: "Aluísio Henrique de Holanda Filho" }), INSCRICOES),
      true,
    );
  });

  it("normaliza pontuação e espaços da origem", () => {
    assert.equal(normalizarNome("  ADRIELLY   SOUSA  OLIVEIRA  "), "ADRIELLY SOUSA OLIVEIRA");
    assert.equal(normalizarNome("Adrielly Sousa Oliveira (OAB/GO)"), "ADRIELLY SOUSA OLIVEIRA OAB GO");
  });

  it("não confunde com outra pessoa", () => {
    assert.equal(nomeConfere(pub({ nomeAdvogadoCitado: "João da Silva" }), INSCRICOES), false);
  });
});

describe("triagem — vinculação", () => {
  it("vincula quando CNJ e OAB conferem", () => {
    const r = triar(pub(), PROCESSOS, INSCRICOES);
    assert.equal(r.destino, "VINCULADA");
    assert.equal(r.processoId, "proc-1");
    assert.equal(r.suspeitaHomonimo, false);
  });
});

describe("triagem — órfã (nada é descartado)", () => {
  it("CNJ válido de processo não cadastrado vira órfã, não lixo", () => {
    const r = triar(pub({ numeroProcesso: CNJ_OUTRO }), PROCESSOS, INSCRICOES);
    assert.equal(r.destino, "ORFA");
    assert.equal(r.processoId, null);
    assert.equal(r.numeroProcessoDigitos, "00012347120235220002");
    assert.match(r.motivo, /não há processo com esse número/);
  });

  it("comunicação sem CNJ identificável também vira órfã", () => {
    const r = triar(
      pub({ numeroProcesso: null, teor: "Comunicação sem número de processo." }),
      PROCESSOS,
      INSCRICOES,
    );
    assert.equal(r.destino, "ORFA");
    assert.equal(r.numeroProcessoDigitos, null);
    assert.match(r.motivo, /não foi possível identificar/i);
  });
});

describe("triagem — homônimo", () => {
  it("nome confere e OAB não: vai para suspeita, NÃO vincula", () => {
    // Vincular a publicação de outro advogado ao nosso processo criaria um
    // prazo falso num caso que não é nosso.
    const r = triar(
      pub({ numeroOabCitado: "12345", ufOabCitada: "SP" }),
      PROCESSOS,
      INSCRICOES,
    );
    assert.equal(r.destino, "SUSPEITA_HOMONIMO");
    assert.equal(r.suspeitaHomonimo, true);
    assert.match(r.motivo, /homônimo/i);
  });

  it("a suspeita prevalece mesmo com CNJ casando", () => {
    const r = triar(
      pub({ numeroProcesso: CNJ, numeroOabCitado: "99999", ufOabCitada: "SP" }),
      PROCESSOS,
      INSCRICOES,
    );
    assert.equal(r.destino, "SUSPEITA_HOMONIMO");
    // O processo provável fica registrado para agilizar a decisão humana,
    // mas a publicação NÃO entra como vinculada.
    assert.equal(r.processoId, "proc-1");
  });

  it("OAB conferindo afasta a suspeita, ainda que o nome venha diferente", () => {
    const r = triar(
      pub({ nomeAdvogadoCitado: "A. S. Oliveira", numeroOabCitado: "76478", ufOabCitada: "GO" }),
      PROCESSOS,
      INSCRICOES,
    );
    assert.equal(r.destino, "VINCULADA");
    assert.equal(r.suspeitaHomonimo, false);
  });

  it("nome desconhecido e OAB desconhecida não é homônimo, é órfã", () => {
    const r = triar(
      pub({
        numeroProcesso: CNJ_OUTRO,
        nomeAdvogadoCitado: "João da Silva",
        numeroOabCitado: "11111",
        ufOabCitada: "SP",
      }),
      PROCESSOS,
      INSCRICOES,
    );
    assert.equal(r.destino, "ORFA");
    assert.equal(r.suspeitaHomonimo, false);
  });
});

// ===========================================================================
// Deduplicação
// ===========================================================================

describe("normalização do teor antes do hash", () => {
  it("colapsa espaços e quebras de linha", () => {
    assert.equal(normalizarTeor("  Intimação   para\n\n contestar. "), "Intimação para contestar.");
  });

  it("mesma acentuação em formas Unicode diferentes gera o mesmo hash", () => {
    const composto = "Intimação";
    const decomposto = "Intimação".normalize("NFD");
    assert.notEqual(composto === decomposto, true);
    assert.equal(hashConteudo(composto), hashConteudo(decomposto));
  });

  it("teor diferente gera hash diferente", () => {
    assert.notEqual(hashConteudo("Contestação"), hashConteudo("Réplica"));
  });
});

describe("chave de deduplicação", () => {
  it("guarda o processo só quando o número tem 20 dígitos", () => {
    assert.equal(
      chaveDeduplicacao({ teor: "x", numeroProcesso: CNJ, dataDisponibilizacao: "2026-03-02" })
        .numeroProcessoDigitos,
      CNJ_DIGITOS,
    );
    assert.equal(
      chaveDeduplicacao({ teor: "x", numeroProcesso: "123", dataDisponibilizacao: "2026-03-02" })
        .numeroProcessoDigitos,
      null,
    );
  });

  it("recorta a data para o dia", () => {
    assert.equal(
      chaveDeduplicacao({ teor: "x", dataDisponibilizacao: "2026-03-02T10:33:00Z" })
        .dataDisponibilizacao,
      "2026-03-02",
    );
  });
});

describe("deduplicação de lote", () => {
  const base = { teor: "Intimação para contestar.", numeroProcesso: CNJ, dataDisponibilizacao: "2026-03-02" };

  it("descarta repetição exata mantendo a primeira", () => {
    const { unicas, descartadas } = deduplicarLote([base, { ...base }, { ...base }]);
    assert.equal(unicas.length, 1);
    assert.equal(descartadas, 2);
  });

  it("descarta repetição com espaçamento diferente", () => {
    // A mesma comunicação volta da fonte com quebra de linha diferente. Duas
    // linhas iguais na fila de triagem custam tempo de advogado.
    const { unicas } = deduplicarLote([base, { ...base, teor: "Intimação  para\ncontestar." }]);
    assert.equal(unicas.length, 1);
  });

  it("mantém publicações de dias diferentes", () => {
    const { unicas } = deduplicarLote([base, { ...base, dataDisponibilizacao: "2026-03-03" }]);
    assert.equal(unicas.length, 2);
  });

  it("mantém publicações de processos diferentes", () => {
    const { unicas } = deduplicarLote([base, { ...base, numeroProcesso: CNJ_OUTRO }]);
    assert.equal(unicas.length, 2);
  });

  it("deduplica ÓRFÃS, que é o caso que mais se repete", () => {
    // Sem número de processo, a chave tem NULL. É exatamente aqui que a
    // deduplicação ingênua falha e a fila de triagem inunda.
    const orfa = { teor: "Comunicação sem número.", dataDisponibilizacao: "2026-03-02" };
    const { unicas, descartadas } = deduplicarLote([orfa, { ...orfa }]);
    assert.equal(unicas.length, 1);
    assert.equal(descartadas, 1);
  });

  it("preserva a ordem original", () => {
    const lote = [
      { ...base, teor: "A" },
      { ...base, teor: "B" },
      { ...base, teor: "A" },
      { ...base, teor: "C" },
    ];
    assert.deepEqual(
      deduplicarLote(lote).unicas.map((p) => p.teor),
      ["A", "B", "C"],
    );
  });
});
