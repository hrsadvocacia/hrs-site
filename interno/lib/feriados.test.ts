import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  domingoDePascoa,
  feriadosFixos,
  feriadosMoveis,
  feriadosNacionais,
} from "./feriados.ts";

describe("domingo de Pascoa", () => {
  // Datas historicas conhecidas — a Pascoa e a ancora de Carnaval,
  // Sexta-feira Santa e Corpus Christi, que deslocam prazo todo ano.
  const conhecidas: ReadonlyArray<readonly [number, string]> = [
    [2020, "2020-04-12"],
    [2021, "2021-04-04"],
    [2022, "2022-04-17"],
    [2023, "2023-04-09"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2029, "2029-04-01"],
    [2030, "2030-04-21"],
  ];

  for (const [ano, esperada] of conhecidas) {
    it(`${ano} -> ${esperada}`, () => {
      assert.equal(domingoDePascoa(ano).toISOString().slice(0, 10), esperada);
    });
  }

  it("cai sempre num domingo", () => {
    for (let ano = 2020; ano <= 2060; ano++) {
      assert.equal(
        domingoDePascoa(ano).getUTCDay(),
        0,
        `Pascoa de ${ano} deveria ser domingo`,
      );
    }
  });

  it("cai sempre entre 22 de marco e 25 de abril", () => {
    for (let ano = 1900; ano <= 2200; ano++) {
      const iso = domingoDePascoa(ano).toISOString().slice(0, 10);
      const md = iso.slice(5);
      assert.ok(md >= "03-22" && md <= "04-25", `${ano}: ${iso}`);
    }
  });
});

describe("feriados moveis", () => {
  it("posiciona corretamente as datas de 2026 (Pascoa em 05/04)", () => {
    const porNome = new Map(feriadosMoveis(2026).map((f) => [f.nome, f.data]));
    assert.equal(porNome.get("Carnaval (segunda-feira)"), "2026-02-16");
    assert.equal(porNome.get("Carnaval (terca-feira)"), "2026-02-17");
    assert.equal(porNome.get("Quarta-feira de Cinzas"), "2026-02-18");
    assert.equal(porNome.get("Sexta-feira Santa"), "2026-04-03");
    assert.equal(porNome.get("Corpus Christi"), "2026-06-04");
  });

  it("Corpus Christi cai sempre numa quinta-feira", () => {
    for (let ano = 2024; ano <= 2040; ano++) {
      const cc = feriadosMoveis(ano).find((f) => f.nome === "Corpus Christi")!;
      assert.equal(new Date(`${cc.data}T00:00:00Z`).getUTCDay(), 4, cc.data);
    }
  });

  it("Sexta-feira Santa cai sempre numa sexta-feira", () => {
    for (let ano = 2024; ano <= 2040; ano++) {
      const sexta = feriadosMoveis(ano).find((f) => f.nome === "Sexta-feira Santa")!;
      assert.equal(new Date(`${sexta.data}T00:00:00Z`).getUTCDay(), 5, sexta.data);
    }
  });

  it("marca Carnaval e Corpus Christi como dependentes de portaria", () => {
    // Nao sao feriado civil por lei federal: sao ponto facultativo. Tratar como
    // feriado automatico faria o motor contar um dia util a menos sem base.
    for (const nome of ["Carnaval (terca-feira)", "Corpus Christi", "Quarta-feira de Cinzas"]) {
      const f = feriadosMoveis(2026).find((x) => x.nome === nome)!;
      assert.match(f.fonte, /portaria/i, nome);
    }
  });
});

describe("feriados fixos", () => {
  it("traz os nove feriados nacionais a partir de 2024", () => {
    const f2026 = feriadosFixos(2026);
    assert.equal(f2026.length, 9);
    assert.ok(f2026.every((f) => f.data.startsWith("2026-")));
  });

  it("Consciencia Negra so e nacional a partir de 2024 (Lei 14.759/2023)", () => {
    const tem = (ano: number) =>
      feriadosFixos(ano).some((f) => f.data.endsWith("-11-20"));
    assert.equal(tem(2023), false);
    assert.equal(tem(2024), true);
    assert.equal(tem(2026), true);
  });

  it("cada feriado fixo declara a lei que o institui", () => {
    for (const f of feriadosFixos(2026)) {
      assert.match(f.fonte, /^Lei /, f.nome);
    }
  });
});

describe("feriadosNacionais", () => {
  it("devolve a lista ordenada por data", () => {
    const datas = feriadosNacionais(2026).map((f) => f.data);
    assert.deepEqual(datas, [...datas].sort());
  });

  it("nao repete data", () => {
    const datas = feriadosNacionais(2026).map((f) => f.data);
    assert.equal(new Set(datas).size, datas.length);
  });
});
