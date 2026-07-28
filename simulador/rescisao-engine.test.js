// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  simularRescisao,
  contarAvos,
  inicioPeriodoAquisitivo,
  diasDeAvisoPrevio,
  calcularINSS,
  calcularIRRF,
  encontrarModalidade,
  EntradaInvalidaError,
  ParametroPendenteError,
} from './rescisao-engine.js';
import { parseISO } from './comum.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parâmetros REAIS do repositório: as regras da CLT (verbas por modalidade,
 * aviso prévio, FGTS) estão confirmadas e devem ser testadas como estão.
 * @type {import('./rescisao-tipos.js').ParametrosRescisao}
 */
const PARAMS = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'parametros-rescisao.json'), 'utf8'));

/**
 * Mesmos parâmetros, mas com tabelas fiscais FICTÍCIAS de teste, para exercitar
 * o caminho de cálculo do líquido. NÃO são as tabelas de produção.
 * @type {import('./rescisao-tipos.js').ParametrosRescisao}
 */
const PARAMS_COM_TABELAS = {
  ...PARAMS,
  tabelaINSS: {
    competencia: 'FIXTURE',
    fonte: 'FIXTURE',
    faixas: [
      { ate: 1500, aliquotaPct: 7.5 },
      { ate: 2800, aliquotaPct: 9 },
      { ate: 4200, aliquotaPct: 12 },
      { ate: 8000, aliquotaPct: 14 },
    ],
  },
  tabelaIRRF: {
    competencia: 'FIXTURE',
    fonte: 'FIXTURE',
    deducaoPorDependente: 189.59,
    descontoSimplificado: 600,
    faixas: [
      { ate: 2400, aliquotaPct: 0, deduzir: 0 },
      { ate: 2800, aliquotaPct: 7.5, deduzir: 180 },
      { ate: 3700, aliquotaPct: 15, deduzir: 390 },
      { ate: 4600, aliquotaPct: 22.5, deduzir: 667.5 },
      { ate: null, aliquotaPct: 27.5, deduzir: 897.5 },
    ],
  },
};

const HOJE = new Date(Date.UTC(2026, 6, 28)); // 28/07/2026, determinístico

/** @param {Partial<import('./rescisao-tipos.js').EntradaRescisao>} over */
function entrada(over = {}) {
  return /** @type {import('./rescisao-tipos.js').EntradaRescisao} */ ({
    modalidade: 'sem_justa_causa',
    salarioMensal: 3000,
    dataAdmissao: '2023-03-10',
    dataSaida: '2026-06-15',
    situacaoAviso: 'indenizado',
    ...over,
  });
}

/** @param {import('./rescisao-tipos.js').ResultadoRescisao} r @param {string} id */
function verba(r, id) {
  const v = r.verbas.find((x) => x.id === id);
  assert.ok(v, `verba "${id}" não encontrada no resultado`);
  return v;
}

// ── Helpers de avos ──────────────────────────────────────────────────────────

test('contarAvos: mês com 15 dias ou mais conta um avo', () => {
  // 17/01 a 31/01 = 15 dias → conta
  assert.equal(contarAvos(parseISO('2026-01-17', 'a'), parseISO('2026-01-31', 'b'), 15), 1);
  // 18/01 a 31/01 = 14 dias → não conta
  assert.equal(contarAvos(parseISO('2026-01-18', 'a'), parseISO('2026-01-31', 'b'), 15), 0);
});

test('contarAvos: ano inteiro = 12 avos', () => {
  assert.equal(contarAvos(parseISO('2026-01-01', 'a'), parseISO('2026-12-31', 'b'), 15), 12);
});

test('contarAvos: intervalo invertido = 0', () => {
  assert.equal(contarAvos(parseISO('2026-05-01', 'a'), parseISO('2026-04-01', 'b'), 15), 0);
});

test('inicioPeriodoAquisitivo: último aniversário de admissão', () => {
  const pa = inicioPeriodoAquisitivo(parseISO('2023-03-10', 'a'), parseISO('2026-06-15', 'b'));
  assert.equal(pa.toISOString().slice(0, 10), '2026-03-10');
});

// ── Aviso prévio ─────────────────────────────────────────────────────────────

test('aviso prévio: 30 dias + 3 por ano completo, teto de 90', () => {
  const regra = encontrarModalidade(PARAMS, 'sem_justa_causa');
  assert.equal(diasDeAvisoPrevio(PARAMS, regra, 0), 30);
  assert.equal(diasDeAvisoPrevio(PARAMS, regra, 3), 39);
  assert.equal(diasDeAvisoPrevio(PARAMS, regra, 20), 90); // 30 + 60 = 90 (teto)
  assert.equal(diasDeAvisoPrevio(PARAMS, regra, 30), 90); // travado no teto
});

test('aviso prévio no pedido de demissão: 30 dias, sem proporcionalidade', () => {
  const regra = encontrarModalidade(PARAMS, 'pedido_demissao');
  assert.equal(diasDeAvisoPrevio(PARAMS, regra, 10), 30);
});

test('aviso prévio na justa causa: zero dias', () => {
  const regra = encontrarModalidade(PARAMS, 'justa_causa');
  assert.equal(diasDeAvisoPrevio(PARAMS, regra, 10), 0);
});

test('aviso indenizado projeta o contrato; trabalhado não projeta', () => {
  const ind = simularRescisao(entrada({ situacaoAviso: 'indenizado' }), PARAMS, { hoje: HOJE });
  assert.equal(ind.avisoPrevioDias, 39); // 3 anos completos
  assert.equal(ind.houveProjecao, true);
  assert.equal(ind.dataFimProjetada, '2026-07-24'); // 15/06 + 39 dias

  const trab = simularRescisao(entrada({ situacaoAviso: 'trabalhado' }), PARAMS, { hoje: HOJE });
  assert.equal(trab.houveProjecao, false);
  assert.equal(trab.dataFimProjetada, '2026-06-15');
  assert.equal(verba(trab, 'aviso_previo_trabalhado').devida, false);
});

// ── Dispensa sem justa causa (caso completo) ─────────────────────────────────

test('sem justa causa: verbas, valores e memória de cálculo', () => {
  const r = simularRescisao(entrada(), PARAMS, { hoje: HOJE });

  assert.equal(r.remuneracaoBase, 3000);
  // Saldo: 15 dias × 3000/30
  assert.equal(verba(r, 'saldo_salario').valor, 1500);
  // Aviso: 39 dias × 100/dia
  assert.equal(verba(r, 'aviso_previo_indenizado').valor, 3900);
  // 13º: jan–jun mais julho (24 dias) por causa da projeção → 7 avos
  assert.equal(verba(r, 'decimo_terceiro_proporcional').valor, 1750);
  // Férias proporcionais: PA de 10/03 a 24/07/2026 → março(22d), abr, mai, jun, jul(24d) = 5 avos
  assert.equal(verba(r, 'ferias_proporcionais_indenizadas').valor, 1250);
  // 1/3 sobre 1250
  assert.equal(verba(r, 'terco_ferias_indenizadas').valor, 416.67);

  assert.equal(r.totalBruto, 1500 + 3900 + 1750 + 1250 + 416.67);
  assert.equal(r.seguroDesemprego.direito, true);
  assert.equal(r.fgts.multaPct, 40);
  assert.equal(r.fgts.saquePct, 100);
});

test('sem justa causa: FGTS soma depósito rescisório à base da multa', () => {
  const r = simularRescisao(entrada({ saldoFGTSInformado: 10000 }), PARAMS, { hoje: HOJE });
  // 8% sobre saldo de salário + aviso indenizado + 13º = 8% de 7150
  assert.equal(r.fgts.depositoRescisorio, 572);
  assert.equal(r.fgts.saldoEstimado, false);
  // multa de 40% sobre 10000 + 572
  assert.equal(r.fgts.multaValor, 4228.8);
  // saque de 100% do saldo + multa integral
  assert.equal(r.fgts.valorDisponivelSaque, 10572 + 4228.8);
});

test('saldo do FGTS não informado é estimado e gera alerta', () => {
  const r = simularRescisao(entrada(), PARAMS, { hoje: HOJE });
  assert.equal(r.fgts.saldoEstimado, true);
  assert.ok(r.alertas.some((a) => a.includes('saldo do FGTS não foi informado')));
});

// ── Pedido de demissão ───────────────────────────────────────────────────────

test('pedido de demissão: sem multa, sem saque, sem seguro-desemprego', () => {
  const r = simularRescisao(entrada({ modalidade: 'pedido_demissao', situacaoAviso: 'trabalhado' }), PARAMS, { hoje: HOJE });
  assert.equal(r.fgts.multaPct, 0);
  assert.equal(r.fgts.saquePct, 0);
  assert.equal(r.fgts.valorDisponivelSaque, 0);
  assert.equal(r.seguroDesemprego.direito, false);
  // Súmula 261 do TST: férias proporcionais continuam devidas
  assert.equal(verba(r, 'ferias_proporcionais_indenizadas').devida, true);
  assert.equal(verba(r, 'decimo_terceiro_proporcional').devida, true);
});

test('pedido de demissão sem cumprir o aviso: desconto de 30 dias', () => {
  const r = simularRescisao(entrada({ modalidade: 'pedido_demissao', situacaoAviso: 'nao_cumprido' }), PARAMS, { hoje: HOJE });
  const d = r.descontos.find((x) => x.id === 'aviso_previo_nao_cumprido');
  assert.ok(d);
  assert.equal(d.valor, 3000); // 30 dias, sem proporcionalidade
  assert.equal(r.liquidoEstimado, r.totalBruto - 3000);
});

test('pedido de demissão com aviso dispensado: sem desconto', () => {
  const r = simularRescisao(entrada({ modalidade: 'pedido_demissao', situacaoAviso: 'dispensado' }), PARAMS, { hoje: HOJE });
  assert.equal(r.descontos.length, 0);
  assert.equal(r.liquidoEstimado, r.totalBruto);
});

// ── Justa causa ──────────────────────────────────────────────────────────────

test('justa causa: só saldo de salário e férias vencidas', () => {
  const r = simularRescisao(
    entrada({ modalidade: 'justa_causa', situacaoAviso: 'dispensado', feriasVencidasPeriodos: 1 }),
    PARAMS, { hoje: HOJE }
  );
  assert.equal(verba(r, 'decimo_terceiro_proporcional').devida, false);
  assert.equal(verba(r, 'ferias_proporcionais_indenizadas').devida, false);
  assert.equal(verba(r, 'ferias_vencidas_indenizadas').devida, true);
  assert.equal(verba(r, 'aviso_previo').devida, false);
  // saldo 1500 + férias vencidas 3000 + 1/3 de 3000
  assert.equal(r.totalBruto, 1500 + 3000 + 1000);
  assert.equal(r.fgts.multaPct, 0);
  assert.equal(r.seguroDesemprego.direito, false);
});

test('justa causa: o terço incide só sobre as férias vencidas', () => {
  const r = simularRescisao(
    entrada({ modalidade: 'justa_causa', situacaoAviso: 'dispensado', feriasVencidasPeriodos: 2 }),
    PARAMS, { hoje: HOJE }
  );
  assert.equal(verba(r, 'terco_ferias_indenizadas').valor, 2000); // 1/3 de 6000
});

// ── Acordo (art. 484-A) ──────────────────────────────────────────────────────

test('acordo: aviso pela metade, multa de 20% e saque de 80%', () => {
  const r = simularRescisao(
    entrada({ modalidade: 'acordo', saldoFGTSInformado: 10000 }), PARAMS, { hoje: HOJE }
  );
  assert.equal(r.avisoPrevioDias, 20); // metade de 39, arredondado
  assert.equal(verba(r, 'aviso_previo_indenizado').valor, 2000);
  assert.equal(r.fgts.multaPct, 20);
  assert.equal(r.fgts.saquePct, 80);
  assert.equal(r.seguroDesemprego.direito, false);
  assert.ok(r.seguroDesemprego.texto.includes('484-A'));

  const base = 10000 + r.fgts.depositoRescisorio;
  assert.equal(r.fgts.multaValor, Math.round(base * 0.2 * 100) / 100);
  assert.equal(r.fgts.valorDisponivelSaque, Math.round(base * 0.8 * 100) / 100 + r.fgts.multaValor);
});

test('acordo: alerta sobre a projeção controvertida do aviso pela metade', () => {
  const r = simularRescisao(entrada({ modalidade: 'acordo' }), PARAMS, { hoje: HOJE });
  assert.ok(r.alertas.some((a) => a.includes('484-A') && a.includes('controvertida')));
});

// ── Rescisão indireta ────────────────────────────────────────────────────────

test('rescisão indireta tem os mesmos efeitos da dispensa sem justa causa', () => {
  const a = simularRescisao(entrada({ modalidade: 'rescisao_indireta', saldoFGTSInformado: 5000 }), PARAMS, { hoje: HOJE });
  const b = simularRescisao(entrada({ saldoFGTSInformado: 5000 }), PARAMS, { hoje: HOJE });
  assert.equal(a.totalBruto, b.totalBruto);
  assert.equal(a.fgts.valorDisponivelSaque, b.fgts.valorDisponivelSaque);
  assert.equal(a.seguroDesemprego.direito, true);
});

// ── Projeção que cruza o ano ─────────────────────────────────────────────────

test('projeção do aviso que cruza o ano gera avos de 13º nos dois anos', () => {
  const r = simularRescisao(
    entrada({ dataAdmissao: '2020-01-06', dataSaida: '2026-12-20' }), PARAMS, { hoje: HOJE }
  );
  assert.equal(r.anosDeCasa, 6);
  assert.equal(r.avisoPrevioDias, 48); // 30 + 18
  assert.equal(r.dataFimProjetada, '2027-02-06');
  // 12 avos de 2026 + 1 avo de 2027 (jan tem 31 dias no intervalo)
  assert.equal(verba(r, 'decimo_terceiro_proporcional').valor, 3250); // 13/12 × 3000
  assert.ok(verba(r, 'decimo_terceiro_proporcional').memoria.includes('2027'));
});

// ── Médias de variáveis ──────────────────────────────────────────────────────

test('médias de horas extras e comissões entram na base de todas as verbas', () => {
  const semMedia = simularRescisao(entrada(), PARAMS, { hoje: HOJE });
  const comMedia = simularRescisao(entrada({ mediaVariaveisMensal: 600 }), PARAMS, { hoje: HOJE });
  assert.equal(comMedia.remuneracaoBase, 3600);
  // 3600/3000 = 1,2 → total bruto 20% maior
  assert.equal(Math.round(comMedia.totalBruto * 100), Math.round(semMedia.totalBruto * 1.2 * 100));
});

// ── Férias: período aquisitivo completo ──────────────────────────────────────

test('período aquisitivo completo alerta sobre dupla contagem', () => {
  // Saída na véspera do aniversário de admissão, com aviso trabalhado (sem projeção):
  // o período aquisitivo 10/03/2025–09/03/2026 fecha os 12 avos.
  const r = simularRescisao(
    entrada({ dataAdmissao: '2023-03-10', dataSaida: '2026-03-09', situacaoAviso: 'trabalhado' }),
    PARAMS, { hoje: HOJE }
  );
  assert.equal(verba(r, 'ferias_proporcionais_indenizadas').valor, 3000); // 12/12
  assert.ok(r.alertas.some((a) => a.includes('duas vezes')));
});

// ── Descontos fiscais ────────────────────────────────────────────────────────

test('sem tabelas fiscais: resultado é bruto, com alerta explícito', () => {
  const r = simularRescisao(entrada(), PARAMS, { hoje: HOJE });
  assert.equal(r.descontosFiscaisCalculados, false);
  assert.equal(r.descontos.length, 0);
  assert.equal(r.liquidoEstimado, r.totalBruto);
  assert.ok(r.alertas.some((a) => a.includes('não foram estimados')));
});

test('com tabelas fiscais: INSS e IRRF entram como desconto', () => {
  const r = simularRescisao(entrada(), PARAMS_COM_TABELAS, { hoje: HOJE });
  assert.equal(r.descontosFiscaisCalculados, true);
  assert.ok(r.descontos.some((d) => d.id === 'inss'));
  assert.ok(r.liquidoEstimado < r.totalBruto);
});

test('férias indenizadas e aviso indenizado ficam fora da base do INSS', () => {
  const r = simularRescisao(entrada({ feriasVencidasPeriodos: 1 }), PARAMS_COM_TABELAS, { hoje: HOJE });
  const inss = r.descontos.find((d) => d.id === 'inss');
  assert.ok(inss);
  // Base do INSS mensal = só o saldo de salário (1500); o 13º (1750) é apurado à parte.
  const esperado =
    Math.round(calcularINSS(150000, PARAMS_COM_TABELAS) + calcularINSS(175000, PARAMS_COM_TABELAS)) / 100;
  assert.equal(inss.valor, esperado);
});

test('calcularINSS: progressivo por faixas, travado no teto', () => {
  // R$ 1.000 → tudo na 1ª faixa: 7,5%
  assert.equal(calcularINSS(100000, PARAMS_COM_TABELAS), 7500);
  // R$ 2.000 → 1500×7,5% + 500×9% = 112,50 + 45,00
  assert.equal(calcularINSS(200000, PARAMS_COM_TABELAS), 15750);
  // Acima do teto de 8.000 trava no valor máximo
  const teto = calcularINSS(800000, PARAMS_COM_TABELAS);
  assert.equal(calcularINSS(2000000, PARAMS_COM_TABELAS), teto);
});

test('calcularIRRF: base isenta não gera imposto e usa a dedução mais favorável', () => {
  assert.equal(calcularIRRF(200000, 15000, 0, PARAMS_COM_TABELAS), 0);
  // Rendimento de R$ 5.000: a dedução simplificada (600) supera o INSS informado (100),
  // então a base cai para 4.400 → faixa de 22,5% com dedução de 667,50.
  const comSimplificado = calcularIRRF(500000, 10000, 0, PARAMS_COM_TABELAS);
  assert.equal(comSimplificado, Math.round(((500000 - 60000) * 22.5) / 100 - 66750));
});

test('tabelas pendentes fazem os cálculos fiscais lançarem ParametroPendenteError', () => {
  assert.throws(() => calcularINSS(100000, PARAMS), ParametroPendenteError);
  assert.throws(() => calcularIRRF(100000, 0, 0, PARAMS), ParametroPendenteError);
});

// ── Validação de entrada ─────────────────────────────────────────────────────

test('salário inválido é rejeitado', () => {
  assert.throws(() => simularRescisao(entrada({ salarioMensal: 0 }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
  assert.throws(() => simularRescisao(entrada({ salarioMensal: -1 }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
});

test('saída anterior à admissão é rejeitada', () => {
  assert.throws(
    () => simularRescisao(entrada({ dataAdmissao: '2026-06-01', dataSaida: '2026-05-01' }), PARAMS, { hoje: HOJE }),
    EntradaInvalidaError
  );
});

test('admissão futura é rejeitada', () => {
  assert.throws(
    () => simularRescisao(entrada({ dataAdmissao: '2027-01-01', dataSaida: '2027-02-01' }), PARAMS, { hoje: HOJE }),
    EntradaInvalidaError
  );
});

test('data em formato inválido é rejeitada', () => {
  assert.throws(() => simularRescisao(entrada({ dataSaida: '15/06/2026' }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
});

test('modalidade desconhecida é rejeitada', () => {
  assert.throws(
    () => simularRescisao(entrada({ modalidade: /** @type {any} */ ('inventada') }), PARAMS, { hoje: HOJE }),
    EntradaInvalidaError
  );
});

test('períodos de férias vencidas devem ser inteiros não negativos', () => {
  assert.throws(() => simularRescisao(entrada({ feriasVencidasPeriodos: -1 }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
  assert.throws(() => simularRescisao(entrada({ feriasVencidasPeriodos: 1.5 }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
});

test('saldo de FGTS negativo é rejeitado', () => {
  assert.throws(() => simularRescisao(entrada({ saldoFGTSInformado: -10 }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
});

// ── Contrato de saída ────────────────────────────────────────────────────────

test('resultado sempre traz premissas, alertas e prazo de pagamento', () => {
  const r = simularRescisao(entrada(), PARAMS, { hoje: HOJE });
  assert.ok(r.premissas.length > 0);
  assert.ok(r.alertas.length > 0);
  assert.equal(r.prazoPagamento.dias, 10);
  assert.ok(r.prazoPagamento.texto.includes('477'));
  assert.equal(r.rotuloModalidade, 'Dispensa sem justa causa');
});

test('total geral soma o líquido da rescisão ao FGTS disponível', () => {
  const r = simularRescisao(entrada({ saldoFGTSInformado: 10000 }), PARAMS, { hoje: HOJE });
  assert.equal(
    Math.round(r.totalGeralEstimado * 100),
    Math.round(r.liquidoEstimado * 100) + Math.round(r.fgts.valorDisponivelSaque * 100)
  );
});

test('toda verba não devida explica o motivo', () => {
  const r = simularRescisao(
    entrada({ modalidade: 'justa_causa', situacaoAviso: 'dispensado' }), PARAMS, { hoje: HOJE }
  );
  for (const v of r.verbas) {
    if (!v.devida) assert.ok(v.motivoNaoDevida, `verba "${v.id}" sem motivoNaoDevida`);
  }
});
