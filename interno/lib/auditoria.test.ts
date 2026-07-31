import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  camposAlterados,
  conferirDescricao,
  DadoPessoalNoLogError,
} from "./auditoria-regras.ts";

describe("log de aplicacao nao pode conter dado pessoal de cliente", () => {
  it("recusa CPF na descricao, com e sem mascara", () => {
    assert.throws(
      () => conferirDescricao("Cliente 529.982.247-25 atualizado"),
      DadoPessoalNoLogError,
    );
    assert.throws(
      () => conferirDescricao("Cliente 52998224725 atualizado"),
      DadoPessoalNoLogError,
    );
  });

  it("recusa CNPJ na descricao", () => {
    assert.throws(
      () => conferirDescricao("Contrato de 11.222.333/0001-81"),
      DadoPessoalNoLogError,
    );
  });

  it("recusa e-mail de cliente na descricao", () => {
    assert.throws(
      () => conferirDescricao("Enviado para joao.silva@exemplo.com.br"),
      DadoPessoalNoLogError,
    );
  });

  it("recusa telefone na descricao", () => {
    assert.throws(
      () => conferirDescricao("Contato por (86) 99985-4705"),
      DadoPessoalNoLogError,
    );
  });

  it("aceita descricao que referencia por identificador, nao por conteudo", () => {
    assert.doesNotThrow(() =>
      conferirDescricao("Cadastro de cliente criado"),
    );
    assert.doesNotThrow(() =>
      conferirDescricao("Prazo conferido e confirmado pelo advogado responsavel"),
    );
    assert.doesNotThrow(() =>
      conferirDescricao("Publicacao triada e vinculada ao processo"),
    );
  });

  it("nomeia o padrao encontrado, para o desenvolvedor entender o bloqueio", () => {
    try {
      conferirDescricao("cliente 529.982.247-25");
      assert.fail("deveria ter lancado");
    } catch (erro) {
      assert.ok(erro instanceof DadoPessoalNoLogError);
      assert.equal(erro.padrao, "CPF");
    }
  });
});

describe("camposAlterados", () => {
  it("devolve apenas os NOMES dos campos, nunca os valores", () => {
    const alterados = camposAlterados(
      { nome: "Maria de Souza", cpfCnpj: "52998224725", ativo: true },
      { nome: "Maria de Souza Lima", cpfCnpj: "52998224725", ativo: true },
    );
    assert.deepEqual(alterados, ["nome"]);
    // O valor antigo nem o novo podem aparecer no resultado.
    assert.equal(JSON.stringify(alterados).includes("Maria"), false);
  });

  it("detecta campo adicionado e removido", () => {
    assert.deepEqual(camposAlterados({ a: 1 }, { a: 1, b: 2 }), ["b"]);
    assert.deepEqual(camposAlterados({ a: 1, b: 2 }, { a: 1 }), ["b"]);
  });

  it("nao acusa mudanca quando nada mudou", () => {
    assert.deepEqual(camposAlterados({ a: 1, b: "x" }, { a: 1, b: "x" }), []);
  });

  it("compara datas por valor, nao por identidade de objeto", () => {
    const d1 = new Date("2026-03-02T10:00:00Z");
    const d2 = new Date("2026-03-02T10:00:00Z");
    const d3 = new Date("2026-03-03T10:00:00Z");
    assert.deepEqual(camposAlterados({ em: d1 }, { em: d2 }), []);
    assert.deepEqual(camposAlterados({ em: d1 }, { em: d3 }), ["em"]);
  });

  it("devolve os campos em ordem estavel", () => {
    const r = camposAlterados({ z: 1, a: 1, m: 1 }, { z: 2, a: 2, m: 2 });
    assert.deepEqual(r, ["a", "m", "z"]);
  });
});
