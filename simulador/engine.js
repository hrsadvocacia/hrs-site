// @ts-check
/**
 * Motor de cálculo do Simulador de Precatório/RPV — funções PURAS.
 *
 * Regra arquitetural inegociável: este módulo NÃO conhece React, DOM nem rede.
 * Recebe um objeto de entrada + os parâmetros legais e devolve um objeto de
 * saída. Toda a lógica jurídica vive aqui e é 100% testável.
 *
 * Dinheiro: toda a matemática interna é feita em CENTAVOS inteiros para evitar
 * erro acumulado de ponto flutuante. A conversão para reais (2 casas) só
 * acontece na fronteira de saída.
 *
 * @module simulador/engine
 */

/** @typedef {import('./tipos.js').EntradaSimulacao} EntradaSimulacao */
/** @typedef {import('./tipos.js').Parametros} Parametros */
/** @typedef {import('./tipos.js').Ente} Ente */
/** @typedef {import('./tipos.js').ResultadoSimulacao} ResultadoSimulacao */
/** @typedef {import('./tipos.js').CenarioRenuncia} CenarioRenuncia */

import {
  EntradaInvalidaError,
  ParametroPendenteError,
  reaisParaCentavos,
  centavosParaReais,
  parseISO,
  mesesEntre,
  apenasData,
} from './comum.js';

// Reexportados para preservar a API pública histórica deste módulo.
export {
  EntradaInvalidaError,
  ParametroPendenteError,
  reaisParaCentavos,
  centavosParaReais,
  parseISO,
  mesesEntre,
};

/**
 * Ente cujo teto de RPV não é fixo nos parâmetros — depende da lei local e não
 * pôde ser determinado (ex.: "Outro ente"). Não é erro de configuração: a
 * interface deve exibir uma orientação em vez de uma classificação.
 */
export class EnteTetoIndefinidoError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'EnteTetoIndefinidoError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parâmetros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Localiza o ente devedor nos parâmetros.
 * @param {Parametros} params @param {string} enteId @returns {Ente}
 */
export function encontrarEnte(params, enteId) {
  const ente = params.entes.find((e) => e.id === enteId);
  if (!ente) throw new EntradaInvalidaError(`Ente devedor desconhecido: "${enteId}".`);
  return ente;
}

/**
 * Teto de RPV do ente, em CENTAVOS. Lança ParametroPendenteError se pendente.
 * @param {Ente} ente @param {Parametros} params @returns {number}
 */
export function tetoRPVEmCentavos(ente, params) {
  const teto = ente.tetoRPV;
  if (ente.tetoInformadoPeloUsuario && teto.quantidade == null) {
    throw new EnteTetoIndefinidoError(
      `O teto de RPV do ente "${ente.id}" depende da lei local e não foi determinado.`
    );
  }
  if (teto.modo === 'reais') {
    if (teto.quantidade == null) {
      throw new ParametroPendenteError(`Teto de RPV (em reais) do ente "${ente.id}" está PENDENTE em parametros.json.`);
    }
    return reaisParaCentavos(teto.quantidade);
  }
  // modo 'salarios_minimos'
  if (teto.quantidade == null) {
    throw new ParametroPendenteError(`Teto de RPV (salários mínimos) do ente "${ente.id}" está PENDENTE em parametros.json.`);
  }
  const sm = params.salarioMinimo.valor;
  if (sm == null) {
    throw new ParametroPendenteError('Valor do salário mínimo está PENDENTE em parametros.json — necessário para calcular o teto de RPV.');
  }
  return Math.round(teto.quantidade * reaisParaCentavos(sm));
}

// ─────────────────────────────────────────────────────────────────────────────
// Prazo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Faixa de prazo do PRECATÓRIO, derivada do calendário orçamentário
 * (data-corte de apresentação vs. exercício orçamentário).
 * @param {EntradaSimulacao} entrada
 * @param {Ente} ente
 * @param {Parametros} params
 * @param {Date} hoje
 * @param {string[]} premissas
 * @param {string[]} alertas
 * @returns {import('./tipos.js').FaixaPrazo}
 */
function prazoPrecatorio(entrada, ente, params, hoje, premissas, alertas) {
  const [ddStr, mmStr] = params.cortePrecatorio.dataLimiteApresentacao.split('-'); // DD-MM
  const corteDia = Number(ddStr);
  const corteMes = Number(mmStr);

  let refData;
  if (entrada.jaExpedido && entrada.dataExpedicao) {
    refData = parseISO(entrada.dataExpedicao, 'dataExpedicao');
  } else {
    refData = apenasData(hoje);
    premissas.push('Como a expedição ainda não ocorreu, o prazo é estimado a partir de uma expedição imediata (data de hoje).');
  }

  const anoRef = refData.getUTCFullYear();
  const corte = new Date(Date.UTC(anoRef, corteMes - 1, corteDia));
  // Apresentado até a data-corte → orçamento do ano seguinte; após → subsequente.
  const anoOrcamento = refData.getTime() <= corte.getTime() ? anoRef + 1 : anoRef + 2;

  const inicioExercicio = new Date(Date.UTC(anoOrcamento, 0, 1));
  const fimExercicio = new Date(Date.UTC(anoOrcamento, 11, 31));
  const hojeD = apenasData(hoje);

  const minMeses = Math.max(0, mesesEntre(hojeD, inicioExercicio));
  const maxMeses = Math.max(minMeses, mesesEntre(hojeD, fimExercicio));

  premissas.push(
    `Data-corte de apresentação considerada: ${corteDia}/${corteMes}. ` +
    `Com base na data de referência (${refData.toISOString().slice(0, 10)}), o precatório ingressa no orçamento de ${anoOrcamento}.`
  );

  const regimeEspecial = ente.regimeEspecial === true;
  if (regimeEspecial) {
    alertas.push('Ente em regime especial de precatórios (EC 136/2025): a quitação é vinculada a um percentual da Receita Corrente Líquida, sem prazo final fixo em lei — o horizonte de pagamento é variável e não pode ser garantido.');
  } else if (ente.regimeEspecial == null) {
    alertas.push('O regime de precatórios deste ente ainda não foi confirmado nos parâmetros do simulador.');
  }

  return {
    minMeses,
    maxMeses: regimeEspecial ? minMeses : maxMeses,
    ...(regimeEspecial ? { semPrazoFinal: true } : {}),
    textoExplicativo: regimeEspecial
      ? `A inclusão orçamentária tende a ocorrer a partir de ${anoOrcamento}. Após a EC 136/2025, ` +
        `o pagamento é feito conforme um percentual da Receita Corrente Líquida do ente, sem data final ` +
        `definida em lei — por isso o horizonte é variável e não pode ser garantido.`
      : `Estimativa baseada no ciclo orçamentário: o precatório tende a ser incluído no orçamento de ${anoOrcamento}, ` +
        `com pagamento previsto ao longo daquele exercício. Prazos podem variar conforme o ente e eventual regime especial.`,
  };
}

/**
 * Faixa de prazo da RPV, a partir dos parâmetros do ente.
 * @param {EntradaSimulacao} entrada
 * @param {Ente} ente
 * @param {string[]} premissas
 * @returns {import('./tipos.js').FaixaPrazo}
 */
function prazoRPV(entrada, ente, premissas) {
  const faixa = ente.prazoRPVMeses;
  if (!faixa || faixa.min == null || faixa.max == null) {
    throw new ParametroPendenteError(`Janela de pagamento de RPV do ente "${ente.id}" está PENDENTE em parametros.json.`);
  }
  if (!entrada.jaExpedido) {
    premissas.push('A RPV ainda não foi expedida; o prazo é contado a partir da futura expedição.');
  }
  const janela = faixa.min === faixa.max
    ? `em torno de ${faixa.min} ${faixa.max === 1 ? 'mês' : 'meses'}`
    : `em uma janela estimada de ${faixa.min} a ${faixa.max} meses`;
  return {
    minMeses: faixa.min,
    maxMeses: faixa.max,
    textoExplicativo:
      `A RPV costuma ser paga ${janela} contados da expedição, ` +
      `sem depender do ciclo orçamentário dos precatórios.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulação principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {EntradaSimulacao} entrada
 * @param {Parametros} params
 * @param {{ hoje?: Date }} [opcoes]
 * @returns {ResultadoSimulacao}
 */
export function simular(entrada, params, opcoes = {}) {
  const hoje = opcoes.hoje ? new Date(opcoes.hoje) : new Date();

  // ── Validação de entrada ────────────────────────────────────────────────
  if (typeof entrada.valorBruto !== 'number' || !Number.isFinite(entrada.valorBruto) || entrada.valorBruto <= 0) {
    throw new EntradaInvalidaError('O valor bruto deve ser um número maior que zero.');
  }
  const dataBase = parseISO(entrada.dataBaseValor, 'dataBaseValor');
  if (dataBase.getTime() > apenasData(hoje).getTime()) {
    throw new EntradaInvalidaError('A data-base do valor não pode ser futura.');
  }
  if (entrada.jaExpedido) {
    if (!entrada.dataExpedicao) {
      throw new EntradaInvalidaError('Informe a data de expedição quando "jaExpedido" for verdadeiro.');
    }
    const dExp = parseISO(entrada.dataExpedicao, 'dataExpedicao');
    if (dExp.getTime() > apenasData(hoje).getTime()) {
      throw new EntradaInvalidaError('A data de expedição não pode ser futura.');
    }
  }
  const pct = entrada.honorariosContratuaisPct ?? 0;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new EntradaInvalidaError('O percentual de honorários contratuais deve estar entre 0 e 100.');
  }

  const ente = encontrarEnte(params, entrada.ente);

  /** @type {string[]} */ const premissas = [];
  /** @type {string[]} */ const alertas = [];

  // ── Valor de referência (v1 NÃO aplica correção monetária) ──────────────
  const valorCentavos = reaisParaCentavos(entrada.valorBruto);
  const valorAtualizadoCentavos = valorCentavos;
  premissas.push(
    `O valor informado (R$ ${entrada.valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é ` +
    `considerado como já atualizado até a data-base (${entrada.dataBaseValor}). Esta ferramenta não aplica ` +
    `correção monetária nem juros — a atualização real será calculada na análise do caso concreto.`
  );

  // ── Teto e classificação ────────────────────────────────────────────────
  const tetoCentavos = tetoRPVEmCentavos(ente, params);
  /** @type {import('./tipos.js').Classificacao} */
  const classificacao = valorAtualizadoCentavos <= tetoCentavos ? 'RPV' : 'PRECATORIO';
  premissas.push(
    `Teto de RPV aplicável a ${ente.nome}: R$ ${centavosParaReais(tetoCentavos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ` +
    `Como o valor é ${classificacao === 'RPV' ? 'menor ou igual' : 'maior'} que o teto, o crédito é classificado como ${classificacao}.`
  );

  // ── Prazo ────────────────────────────────────────────────────────────────
  const faixaPrazo =
    classificacao === 'RPV'
      ? prazoRPV(entrada, ente, premissas)
      : prazoPrecatorio(entrada, ente, params, hoje, premissas, alertas);

  // ── Preferência ──────────────────────────────────────────────────────────
  const preferencial = !!entrada.temPreferencia;
  if (preferencial) {
    alertas.push('Crédito preferencial (idoso 60+, doença grave ou pessoa com deficiência): fila própria e possibilidade de destaque preferencial em precatórios.');
  }

  // ── Cenário de renúncia (art. 100, §4º, CF) ─────────────────────────────
  /** @type {CenarioRenuncia | undefined} */
  let cenarioRenuncia;
  if (valorAtualizadoCentavos > tetoCentavos && valorAtualizadoCentavos <= 2 * tetoCentavos) {
    const perdaCentavos = valorAtualizadoCentavos - tetoCentavos;

    // Ganho de tempo: ponto médio do prazo de precatório menos o de RPV.
    const precFaixa = prazoPrecatorio(entrada, ente, params, hoje, [], []);
    const rpvFaixa = prazoRPV(entrada, ente, []);
    const precMeio = (precFaixa.minMeses + precFaixa.maxMeses) / 2;
    const rpvMeio = (rpvFaixa.minMeses + rpvFaixa.maxMeses) / 2;
    const ganhoEmTempoMeses = Math.max(0, Math.round(precMeio - rpvMeio));

    const perdaReais = centavosParaReais(perdaCentavos);
    cenarioRenuncia = {
      valorAposRenuncia: centavosParaReais(tetoCentavos),
      perdaEmReais: perdaReais,
      ganhoEmTempoMeses,
      textoTradeoff:
        `Você pode renunciar ao valor que excede o teto para receber como RPV: ` +
        `abre mão de R$ ${perdaReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ` +
        `para receber cerca de ${ganhoEmTempoMeses} meses antes. É uma decisão que depende do seu caso — ` +
        `o escritório pode ajudar a avaliar se compensa.`,
    };
    premissas.push('O cenário de renúncia estima o ganho de tempo pela diferença entre os prazos médios de precatório e de RPV.');
  }

  // ── Descontos ────────────────────────────────────────────────────────────
  /** @type {import('./tipos.js').DescontosEstimados} */
  const descontosEstimados = {
    observacao:
      'Estimativa não inclui IRRF sobre Rendimentos Recebidos Acumuladamente (RRA) nem contribuição previdenciária, ' +
      'que dependem da natureza da verba e serão apurados na análise dos autos.',
  };
  if (params.tributacao.irrfRRA.aplicavel) {
    alertas.push('Pode haver retenção de Imposto de Renda sobre Rendimentos Recebidos Acumuladamente (RRA); o valor exato não é estimado nesta versão.');
  }

  let honorariosCentavos = 0;
  if (pct > 0) {
    honorariosCentavos = Math.round((valorAtualizadoCentavos * pct) / 100);
    descontosEstimados.honorariosContratuais = centavosParaReais(honorariosCentavos);
    if (entrada.destacarHonorarios) {
      premissas.push(
        `Honorários contratuais de ${pct}% destacados na origem (art. 22, §4º, EAOAB): são pagos diretamente ao ` +
        `advogado e NÃO saem do valor que você recebe.`
      );
    } else {
      premissas.push(`Honorários contratuais de ${pct}% deduzidos do valor a receber.`);
    }
  }

  // ── Líquido estimado ─────────────────────────────────────────────────────
  const deduzHonorarios = pct > 0 && !entrada.destacarHonorarios;
  const liquidoCentavos = valorAtualizadoCentavos - (deduzHonorarios ? honorariosCentavos : 0);

  return {
    classificacao,
    tetoRPVAplicavel: centavosParaReais(tetoCentavos),
    valorAtualizadoEstimado: centavosParaReais(valorAtualizadoCentavos),
    faixaPrazo,
    ...(cenarioRenuncia ? { cenarioRenuncia } : {}),
    descontosEstimados,
    liquidoEstimado: centavosParaReais(liquidoCentavos),
    preferencial,
    alertas,
    premissas,
  };
}
