// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  simular,
  tetoRPVEmCentavos,
  mesesEntre,
  parseISO,
  EntradaInvalidaError,
  ParametroPendenteError,
} from './engine.js';

/**
 * Parâmetros de FIXTURE — valores fictícios, exclusivos de teste.
 * NÃO são os parâmetros legais de produção (esses ficam pendentes em
 * data/parametros.json até revisão de advogado). Salário mínimo de teste:
 * R$ 1.500,00 → teto União (60 SM) = R$ 90.000,00.
 * @type {import('./tipos.js').Parametros}
 */
const PARAMS = {
  salarioMinimo: { valor: 1500, vigenciaDesde: '2025-01-01', fonte: 'FIXTURE' },
  entes: [
    {
      id: 'uniao-federal',
      nome: 'União',
      tetoRPV: { modo: 'salarios_minimos', quantidade: 60, fonte: 'FIXTURE' },
      regimeEspecial: false,
      prazoRPVMeses: { min: 2, max: 6 },
    },
    {
      id: 'ente-regime-especial',
      nome: 'Ente RE',
      tetoRPV: { modo: 'salarios_minimos', quantidade: 40, fonte: 'FIXTURE' },
      regimeEspecial: true,
      prazoRPVMeses: { min: 3, max: 8 },
    },
    {
      id: 'ente-pendente',
      nome: 'Ente Pendente',
      tetoRPV: { modo: 'salarios_minimos', quantidade: null, fonte: 'PREENCHER' },
      regimeEspecial: null,
      prazoRPVMeses: { min: null, max: null },
    },
  ],
  cortePrecatorio: { dataLimiteApresentacao: '02-04', obs: 'FIXTURE' },
  atualizacao: { indice: '', juros: '', fonte: 'FIXTURE' },
  tributacao: {
    irrfRRA: { aplicavel: true, obs: 'FIXTURE' },
    contribuicaoPrevidenciaria: { aplicavel: true, obs: 'FIXTURE' },
  },
};

const HOJE = new Date(Date.UTC(2025, 4, 1)); // 01/05/2025, determinístico

/** @param {Partial<import('./tipos.js').EntradaSimulacao>} over */
function entrada(over = {}) {
  return {
    ente: 'uniao-federal',
    naturezaCredito: 'alimentar',
    valorBruto: 50000,
    dataBaseValor: '2024-12-01',
    temPreferencia: false,
    jaExpedido: false,
    ...over,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

test('teto da União = 60 SM = R$ 90.000,00', () => {
  assert.equal(tetoRPVEmCentavos(PARAMS.entes[0], PARAMS), 9000000);
});

test('mesesEntre conta meses de calendário', () => {
  assert.equal(mesesEntre(new Date(Date.UTC(2025, 0, 15)), new Date(Date.UTC(2026, 0, 1))), 11);
  assert.equal(mesesEntre(new Date(Date.UTC(2025, 0, 15)), new Date(Date.UTC(2025, 0, 15))), 0);
});

// ── Classificação: teto exato e 1 centavo acima ─────────────────────────────

test('valor exatamente no teto → RPV', () => {
  const r = simular(entrada({ valorBruto: 90000 }), PARAMS, { hoje: HOJE });
  assert.equal(r.classificacao, 'RPV');
  assert.equal(r.tetoRPVAplicavel, 90000);
});

test('valor 1 centavo acima do teto → PRECATÓRIO', () => {
  const r = simular(entrada({ valorBruto: 90000.01 }), PARAMS, { hoje: HOJE });
  assert.equal(r.classificacao, 'PRECATORIO');
});

// ── Zona de renúncia (limite inferior e superior) ───────────────────────────

test('renúncia — limite inferior (teto + 1 centavo)', () => {
  const r = simular(entrada({ valorBruto: 90000.01 }), PARAMS, { hoje: HOJE });
  assert.ok(r.cenarioRenuncia, 'deve haver cenário de renúncia');
  assert.equal(r.cenarioRenuncia.valorAposRenuncia, 90000);
  assert.equal(r.cenarioRenuncia.perdaEmReais, 0.01);
  assert.ok(r.cenarioRenuncia.ganhoEmTempoMeses >= 0);
});

test('renúncia — limite superior (2× teto) ainda oferece cenário', () => {
  const r = simular(entrada({ valorBruto: 180000 }), PARAMS, { hoje: HOJE });
  assert.ok(r.cenarioRenuncia);
  assert.equal(r.cenarioRenuncia.perdaEmReais, 90000);
});

test('acima de 2× teto → sem cenário de renúncia', () => {
  const r = simular(entrada({ valorBruto: 180000.01 }), PARAMS, { hoje: HOJE });
  assert.equal(r.cenarioRenuncia, undefined);
  assert.equal(r.classificacao, 'PRECATORIO');
});

// ── Crédito preferencial ─────────────────────────────────────────────────────

test('crédito preferencial gera flag e alerta', () => {
  const r = simular(entrada({ temPreferencia: true }), PARAMS, { hoje: HOJE });
  assert.equal(r.preferencial, true);
  assert.ok(r.alertas.some((a) => a.toLowerCase().includes('preferencial')));
});

// ── Corte orçamentário: 1º de abril vs 3 de abril ───────────────────────────

test('expedição 1º/abril entra em orçamento um ano antes de 3/abril', () => {
  const base = { valorBruto: 100000, jaExpedido: true }; // > teto → precatório
  const antesCorte = simular(entrada({ ...base, dataExpedicao: '2025-04-01' }), PARAMS, { hoje: HOJE });
  const aposCorte = simular(entrada({ ...base, dataExpedicao: '2025-04-03' }), PARAMS, { hoje: HOJE });
  // 01/04/2025 ≤ 02/04 → orçamento 2026 ; 03/04/2025 > 02/04 → orçamento 2027
  assert.ok(aposCorte.faixaPrazo.maxMeses > antesCorte.faixaPrazo.maxMeses);
  assert.ok(aposCorte.faixaPrazo.minMeses > antesCorte.faixaPrazo.minMeses);
});

// ── Honorários com e sem destaque ───────────────────────────────────────────

test('honorários SEM destaque são deduzidos do líquido', () => {
  const r = simular(entrada({ valorBruto: 50000, honorariosContratuaisPct: 20 }), PARAMS, { hoje: HOJE });
  assert.equal(r.descontosEstimados.honorariosContratuais, 10000);
  assert.equal(r.liquidoEstimado, 40000);
});

test('honorários COM destaque NÃO reduzem o líquido', () => {
  const r = simular(
    entrada({ valorBruto: 50000, honorariosContratuaisPct: 20, destacarHonorarios: true }),
    PARAMS,
    { hoje: HOJE }
  );
  assert.equal(r.descontosEstimados.honorariosContratuais, 10000);
  assert.equal(r.liquidoEstimado, 50000);
});

// ── Regime especial ──────────────────────────────────────────────────────────

test('ente em regime especial gera alerta de parcelamento', () => {
  const r = simular(
    entrada({ ente: 'ente-regime-especial', valorBruto: 100000, jaExpedido: true, dataExpedicao: '2025-01-10' }),
    PARAMS,
    { hoje: HOJE }
  );
  assert.equal(r.classificacao, 'PRECATORIO');
  assert.ok(r.alertas.some((a) => a.toLowerCase().includes('regime especial')));
});

// ── Entradas inválidas ───────────────────────────────────────────────────────

test('valor negativo → EntradaInvalidaError', () => {
  assert.throws(() => simular(entrada({ valorBruto: -1 }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
});

test('valor zero → EntradaInvalidaError', () => {
  assert.throws(() => simular(entrada({ valorBruto: 0 }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
});

test('data-base futura → EntradaInvalidaError', () => {
  assert.throws(
    () => simular(entrada({ dataBaseValor: '2025-06-01' }), PARAMS, { hoje: HOJE }),
    EntradaInvalidaError
  );
});

test('data de expedição futura → EntradaInvalidaError', () => {
  assert.throws(
    () => simular(entrada({ jaExpedido: true, dataExpedicao: '2025-12-01' }), PARAMS, { hoje: HOJE }),
    EntradaInvalidaError
  );
});

test('jaExpedido sem dataExpedicao → EntradaInvalidaError', () => {
  assert.throws(() => simular(entrada({ jaExpedido: true }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
});

test('percentual de honorários fora de 0–100 → EntradaInvalidaError', () => {
  assert.throws(() => simular(entrada({ honorariosContratuaisPct: 150 }), PARAMS, { hoje: HOJE }), EntradaInvalidaError);
});

test('data inválida (30 de fevereiro) → EntradaInvalidaError', () => {
  assert.throws(() => parseISO('2025-02-30', 'x'), EntradaInvalidaError);
});

// ── Parâmetro pendente ───────────────────────────────────────────────────────

test('ente com teto pendente → ParametroPendenteError', () => {
  assert.throws(
    () => simular(entrada({ ente: 'ente-pendente', valorBruto: 10000 }), PARAMS, { hoje: HOJE }),
    ParametroPendenteError
  );
});

test('salário mínimo pendente → ParametroPendenteError', () => {
  const semSM = { ...PARAMS, salarioMinimo: { valor: null, vigenciaDesde: '', fonte: 'PREENCHER' } };
  assert.throws(
    () => simular(entrada({ valorBruto: 10000 }), /** @type {any} */ (semSM), { hoje: HOJE }),
    ParametroPendenteError
  );
});

// ── Premissas e disclaimer de dados ─────────────────────────────────────────

test('resultado sempre lista premissas e não aplica correção monetária', () => {
  const r = simular(entrada(), PARAMS, { hoje: HOJE });
  assert.ok(r.premissas.length > 0);
  assert.ok(r.premissas.some((p) => p.toLowerCase().includes('não aplica correção')));
});
