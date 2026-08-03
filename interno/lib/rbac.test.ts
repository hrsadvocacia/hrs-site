import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AcessoNegadoError,
  MATRIZ_PERMISSOES,
  type Perfil,
  pode,
  podeConfirmarPrazo,
  podeOuFalha,
} from "./rbac.ts";

const PERFIS: readonly Perfil[] = [
  "SOCIO",
  "ADVOGADO",
  "ESTAGIARIO",
  "FINANCEIRO",
  "ADMIN",
];

describe("regra central: confirmacao de prazo e ato privativo de advogado", () => {
  it("SOCIO e ADVOGADO confirmam prazo", () => {
    assert.equal(podeConfirmarPrazo("SOCIO"), true);
    assert.equal(podeConfirmarPrazo("ADVOGADO"), true);
  });

  it("ESTAGIARIO NAO confirma prazo", () => {
    assert.equal(podeConfirmarPrazo("ESTAGIARIO"), false);
    assert.throws(
      () => podeOuFalha("ESTAGIARIO", "prazo", "confirmar"),
      AcessoNegadoError,
    );
  });

  it("FINANCEIRO e ADMIN nao confirmam prazo", () => {
    assert.equal(podeConfirmarPrazo("FINANCEIRO"), false);
    assert.equal(podeConfirmarPrazo("ADMIN"), false);
  });

  it("apenas dois perfis no escritorio inteiro confirmam prazo", () => {
    const confirmam = PERFIS.filter(podeConfirmarPrazo);
    assert.deepEqual(confirmam, ["SOCIO", "ADVOGADO"]);
  });
});

describe("ESTAGIARIO nao acessa financeiro", () => {
  it("nenhuma acao em financeiro", () => {
    for (const acao of ["ler", "criar", "editar", "exportar"] as const) {
      assert.equal(pode("ESTAGIARIO", "financeiro", acao), false, acao);
    }
  });

  it("mas instrui processo normalmente", () => {
    assert.equal(pode("ESTAGIARIO", "processo", "criar"), true);
    assert.equal(pode("ESTAGIARIO", "prazo", "criar"), true);
  });

  it("nao le dado sensivel de saude", () => {
    assert.equal(pode("ESTAGIARIO", "dadoSensivel", "ler"), false);
    assert.equal(pode("ESTAGIARIO", "documentoSensivel", "ler"), false);
  });
});

describe("FINANCEIRO nao acessa estrategia processual nem documento sensivel", () => {
  it("nao le anotacao privilegiada", () => {
    for (const acao of ["ler", "criar", "editar", "exportar"] as const) {
      assert.equal(pode("FINANCEIRO", "anotacaoPrivilegiada", acao), false, acao);
    }
  });

  it("nao le documento sensivel nem dado de saude", () => {
    assert.equal(pode("FINANCEIRO", "documentoSensivel", "ler"), false);
    assert.equal(pode("FINANCEIRO", "dadoSensivel", "ler"), false);
  });

  it("nao ve prazo nem publicacao", () => {
    assert.equal(pode("FINANCEIRO", "prazo", "ler"), false);
    assert.equal(pode("FINANCEIRO", "publicacao", "ler"), false);
  });

  it("mas opera honorarios integralmente", () => {
    for (const acao of ["ler", "criar", "editar", "exportar"] as const) {
      assert.equal(pode("FINANCEIRO", "financeiro", acao), true, acao);
    }
  });

  it("le o processo apenas para identificar o contrato, sem editar", () => {
    assert.equal(pode("FINANCEIRO", "processo", "ler"), true);
    assert.equal(pode("FINANCEIRO", "processo", "editar"), false);
  });
});

describe("ADMIN administra sem ler dado de cliente", () => {
  it("nao acessa cliente, processo nem dado sensivel", () => {
    assert.equal(pode("ADMIN", "cliente", "ler"), false);
    assert.equal(pode("ADMIN", "processo", "ler"), false);
    assert.equal(pode("ADMIN", "dadoSensivel", "ler"), false);
    assert.equal(pode("ADMIN", "anotacaoPrivilegiada", "ler"), false);
  });

  it("gerencia usuarios e calendario", () => {
    assert.equal(pode("ADMIN", "usuario", "criar"), true);
    assert.equal(pode("ADMIN", "calendario", "editar"), true);
  });
});

describe("dado sensivel de saude — superficie minima", () => {
  it("so SOCIO e ADVOGADO leem", () => {
    const leem = PERFIS.filter((p) => pode(p, "dadoSensivel", "ler"));
    assert.deepEqual(leem, ["SOCIO", "ADVOGADO"]);
  });

  it("ninguem exporta dado sensivel de saude", () => {
    for (const perfil of PERFIS) {
      assert.equal(
        pode(perfil, "dadoSensivel", "exportar"),
        false,
        `${perfil} nao deve exportar dado de saude`,
      );
    }
  });

  it("ninguem inativa registro de dado sensivel pela matriz", () => {
    for (const perfil of PERFIS) {
      assert.equal(pode(perfil, "dadoSensivel", "inativar"), false, perfil);
    }
  });
});

describe("auditoria", () => {
  it("e legivel apenas por SOCIO e ADMIN", () => {
    const leem = PERFIS.filter((p) => pode(p, "auditoria", "ler"));
    assert.deepEqual(leem, ["SOCIO", "ADMIN"]);
  });

  it("nao e editavel nem apagavel por ninguem — nem na matriz", () => {
    for (const perfil of PERFIS) {
      for (const acao of ["criar", "editar", "inativar"] as const) {
        assert.equal(pode(perfil, "auditoria", acao), false, `${perfil}/${acao}`);
      }
    }
  });
});

describe("calendário forense", () => {
  it("é mantido por SOCIO e ADMIN", () => {
    const mantem = PERFIS.filter((p) => pode(p, "calendario", "editar"));
    assert.deepEqual(mantem, ["SOCIO", "ADMIN"]);
  });

  it("advogado e estagiário consultam mas não alteram", () => {
    for (const perfil of ["ADVOGADO", "ESTAGIARIO"] as const) {
      assert.equal(pode(perfil, "calendario", "ler"), true, perfil);
      assert.equal(pode(perfil, "calendario", "editar"), false, perfil);
    }
  });
});

describe("relatorio do socio", () => {
  it("e exclusivo do socio", () => {
    const acessam = PERFIS.filter((p) => pode(p, "relatorioSocio", "ler"));
    assert.deepEqual(acessam, ["SOCIO"]);
  });
});

describe("integridade da matriz", () => {
  it("todo perfil declara todo recurso — sem buraco por omissao", () => {
    const recursos = Object.keys(MATRIZ_PERMISSOES.SOCIO).sort();
    for (const perfil of PERFIS) {
      assert.deepEqual(
        Object.keys(MATRIZ_PERMISSOES[perfil]).sort(),
        recursos,
        `perfil ${perfil} nao declara os mesmos recursos`,
      );
    }
  });

  it("podeOuFalha permite o que pode e bloqueia o que nao pode", () => {
    assert.doesNotThrow(() => podeOuFalha("ADVOGADO", "prazo", "confirmar"));
    assert.throws(() => podeOuFalha("FINANCEIRO", "prazo", "ler"), AcessoNegadoError);
  });

  it("mensagem de acesso negado nao vaza dado de cliente", () => {
    try {
      podeOuFalha("ESTAGIARIO", "dadoSensivel", "ler");
      assert.fail("deveria ter lancado");
    } catch (erro) {
      assert.ok(erro instanceof AcessoNegadoError);
      assert.match(erro.message, /^Perfil ESTAGIARIO nao tem permissao/);
    }
  });
});
