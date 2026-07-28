// @ts-check
/**
 * Motor de cálculo do Simulador de Verbas Rescisórias — funções PURAS.
 *
 * Mesma regra arquitetural do motor de precatório/RPV: este módulo NÃO conhece
 * DOM nem rede. Recebe um objeto de entrada + os parâmetros legais e devolve um
 * objeto de saída. Toda a lógica jurídica vive aqui e é 100% testável.
 *
 * Dinheiro: toda a matemática interna é feita em CENTAVOS inteiros. A conversão
 * para reais só acontece na fronteira de saída.
 *
 * Nenhuma regra é "hardcoded": as verbas devidas em cada modalidade, os
 * percentuais de FGTS, o aviso prévio e as incidências vêm de
 * `data/parametros-rescisao.json`.
 *
 * @module simulador/rescisao-engine
 */

import {
  EntradaInvalidaError,
  ParametroPendenteError,
  reaisParaCentavos,
  centavosParaReais,
  formatarBRL,
  parseISO,
  mesesEntre,
  apenasData,
  somarDias,
  anosCompletos,
  paraISO,
  UM_DIA_MS,
} from './comum.js';

export { EntradaInvalidaError, ParametroPendenteError };

/** @typedef {import('./rescisao-tipos.js').EntradaRescisao} EntradaRescisao */
/** @typedef {import('./rescisao-tipos.js').ParametrosRescisao} ParametrosRescisao */
/** @typedef {import('./rescisao-tipos.js').RegraModalidade} RegraModalidade */
/** @typedef {import('./rescisao-tipos.js').ResultadoRescisao} ResultadoRescisao */
/** @typedef {import('./rescisao-tipos.js').Verba} Verba */
/** @typedef {import('./rescisao-tipos.js').Desconto} Desconto */

// ─────────────────────────────────────────────────────────────────────────────
// Avos (frações de 1/12)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conta quantos meses do intervalo [inicio, fim] têm pelo menos `diasMinimos`
 * dias trabalhados — a regra dos "avos" do 13º e das férias proporcionais.
 *
 * @param {Date} inicio
 * @param {Date} fim
 * @param {number} diasMinimos
 * @returns {number}
 */
export function contarAvos(inicio, fim, diasMinimos) {
  if (fim.getTime() < inicio.getTime()) return 0;
  let avos = 0;
  let ano = inicio.getUTCFullYear();
  let mes = inicio.getUTCMonth();
  const anoFim = fim.getUTCFullYear();
  const mesFim = fim.getUTCMonth();

  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    const primeiro = new Date(Date.UTC(ano, mes, 1));
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0));
    const de = primeiro.getTime() > inicio.getTime() ? primeiro : inicio;
    const ate = ultimo.getTime() < fim.getTime() ? ultimo : fim;
    const dias = Math.floor((ate.getTime() - de.getTime()) / UM_DIA_MS) + 1;
    if (dias >= diasMinimos) avos += 1;
    mes += 1;
    if (mes > 11) { mes = 0; ano += 1; }
  }
  return avos;
}

/**
 * Início do período aquisitivo de férias em curso na data `referencia`:
 * o último aniversário de admissão anterior ou igual a ela.
 *
 * @param {Date} admissao
 * @param {Date} referencia
 * @returns {Date}
 */
export function inicioPeriodoAquisitivo(admissao, referencia) {
  const anos = anosCompletos(admissao, referencia);
  return new Date(Date.UTC(admissao.getUTCFullYear() + anos, admissao.getUTCMonth(), admissao.getUTCDate()));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabelas fiscais
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A tabela do INSS está preenchida e utilizável?
 * @param {ParametrosRescisao} params @returns {boolean}
 */
export function temTabelaINSS(params) {
  return Array.isArray(params?.tabelaINSS?.faixas) && params.tabelaINSS.faixas.length > 0;
}

/**
 * A tabela do IRRF está preenchida e utilizável?
 * @param {ParametrosRescisao} params @returns {boolean}
 */
export function temTabelaIRRF(params) {
  return Array.isArray(params?.tabelaIRRF?.faixas) && params.tabelaIRRF.faixas.length > 0;
}

/**
 * Contribuição previdenciária do empregado, por faixas progressivas.
 * Retorna CENTAVOS.
 *
 * @param {number} baseCentavos
 * @param {ParametrosRescisao} params
 * @returns {number}
 */
export function calcularINSS(baseCentavos, params) {
  if (!temTabelaINSS(params)) {
    throw new ParametroPendenteError('Tabela do INSS está PENDENTE em parametros-rescisao.json.');
  }
  if (baseCentavos <= 0) return 0;
  let total = 0;
  let anterior = 0;
  for (const faixa of params.tabelaINSS.faixas) {
    const teto = reaisParaCentavos(faixa.ate);
    const trecho = Math.min(baseCentavos, teto) - anterior;
    if (trecho > 0) total += (trecho * faixa.aliquotaPct) / 100;
    anterior = teto;
    if (baseCentavos <= teto) break;
  }
  return Math.round(total);
}

/**
 * IRRF sobre uma base mensal, aplicando a dedução mais favorável entre a legal
 * (INSS + dependentes) e o desconto simplificado. Retorna CENTAVOS.
 *
 * @param {number} rendimentoCentavos
 * @param {number} inssCentavos
 * @param {number} dependentes
 * @param {ParametrosRescisao} params
 * @returns {number}
 */
export function calcularIRRF(rendimentoCentavos, inssCentavos, dependentes, params) {
  if (!temTabelaIRRF(params)) {
    throw new ParametroPendenteError('Tabela do IRRF está PENDENTE em parametros-rescisao.json.');
  }
  if (rendimentoCentavos <= 0) return 0;

  const porDependente = params.tabelaIRRF.deducaoPorDependente ?? 0;
  const deducaoLegal = inssCentavos + Math.round(dependentes * reaisParaCentavos(porDependente));
  const simplificado = params.tabelaIRRF.descontoSimplificado != null
    ? reaisParaCentavos(params.tabelaIRRF.descontoSimplificado)
    : 0;
  const deducao = Math.max(deducaoLegal, simplificado);

  const base = Math.max(0, rendimentoCentavos - deducao);
  for (const faixa of params.tabelaIRRF.faixas) {
    const teto = faixa.ate == null ? Infinity : reaisParaCentavos(faixa.ate);
    if (base <= teto) {
      const imposto = (base * faixa.aliquotaPct) / 100 - reaisParaCentavos(faixa.deduzir);
      return Math.max(0, Math.round(imposto));
    }
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parâmetros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Localiza a regra da modalidade nos parâmetros.
 * @param {ParametrosRescisao} params @param {string} id @returns {RegraModalidade}
 */
export function encontrarModalidade(params, id) {
  const regra = params?.modalidades?.[id];
  if (!regra) throw new EntradaInvalidaError(`Modalidade de rescisão desconhecida: "${id}".`);
  return regra;
}

/**
 * Dias de aviso prévio devidos, já considerando a proporcionalidade da
 * Lei 12.506/2011 (que só beneficia o empregado) e o teto de 90 dias.
 *
 * @param {ParametrosRescisao} params
 * @param {RegraModalidade} regra
 * @param {number} anosDeCasa
 * @returns {number}
 */
export function diasDeAvisoPrevio(params, regra, anosDeCasa) {
  const cfg = params.avisoPrevio;
  if (regra.avisoPrevio.devidoPor === 'nenhum') return 0;
  if (!regra.avisoPrevio.proporcional) return cfg.diasBase;
  const dias = cfg.diasBase + cfg.diasAdicionaisPorAnoCompleto * anosDeCasa;
  return Math.min(dias, cfg.diasMaximo);
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulação principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {EntradaRescisao} entrada
 * @param {ParametrosRescisao} params
 * @param {{ hoje?: Date }} [opcoes]
 * @returns {ResultadoRescisao}
 */
export function simularRescisao(entrada, params, opcoes = {}) {
  const hoje = apenasData(opcoes.hoje ? new Date(opcoes.hoje) : new Date());

  // ── Validação de entrada ────────────────────────────────────────────────
  if (typeof entrada.salarioMensal !== 'number' || !Number.isFinite(entrada.salarioMensal) || entrada.salarioMensal <= 0) {
    throw new EntradaInvalidaError('O salário mensal deve ser um número maior que zero.');
  }
  const medias = entrada.mediaVariaveisMensal ?? 0;
  if (typeof medias !== 'number' || !Number.isFinite(medias) || medias < 0) {
    throw new EntradaInvalidaError('A média de verbas variáveis não pode ser negativa.');
  }
  const admissao = parseISO(entrada.dataAdmissao, 'dataAdmissao');
  const saida = parseISO(entrada.dataSaida, 'dataSaida');
  if (saida.getTime() < admissao.getTime()) {
    throw new EntradaInvalidaError('A data de saída não pode ser anterior à data de admissão.');
  }
  if (admissao.getTime() > hoje.getTime()) {
    throw new EntradaInvalidaError('A data de admissão não pode ser futura.');
  }
  const periodosVencidos = entrada.feriasVencidasPeriodos ?? 0;
  if (!Number.isInteger(periodosVencidos) || periodosVencidos < 0) {
    throw new EntradaInvalidaError('O número de períodos de férias vencidas deve ser um inteiro não negativo.');
  }
  const dependentes = entrada.dependentesIR ?? 0;
  if (!Number.isInteger(dependentes) || dependentes < 0) {
    throw new EntradaInvalidaError('O número de dependentes deve ser um inteiro não negativo.');
  }
  if (entrada.saldoFGTSInformado != null &&
      (!Number.isFinite(entrada.saldoFGTSInformado) || entrada.saldoFGTSInformado < 0)) {
    throw new EntradaInvalidaError('O saldo do FGTS não pode ser negativo.');
  }

  const regra = encontrarModalidade(params, entrada.modalidade);

  /** @type {string[]} */ const premissas = [];
  /** @type {string[]} */ const alertas = [];
  /** @type {Verba[]}   */ const verbas = [];
  /** @type {Desconto[]} */ const descontos = [];

  // ── Base de cálculo ──────────────────────────────────────────────────────
  const remuneracaoCentavos = reaisParaCentavos(entrada.salarioMensal + medias);
  const divisor = params.remuneracao.divisorMensal;
  /** Valor de `dias` dias de remuneração, em centavos. @param {number} dias */
  const porDia = (dias) => Math.round((remuneracaoCentavos * dias) / divisor);
  /** Valor de `avos` avos (1/12) de remuneração, em centavos. @param {number} avos */
  const porAvo = (avos) => Math.round((remuneracaoCentavos * avos) / params.decimoTerceiro.avosPorAno);

  if (medias > 0) {
    premissas.push(
      `A base de cálculo das verbas é a remuneração de R$ ${formatarBRL(remuneracaoCentavos)}: ` +
      `salário de R$ ${formatarBRL(reaisParaCentavos(entrada.salarioMensal))} mais a média de ` +
      `R$ ${formatarBRL(reaisParaCentavos(medias))} de horas extras, comissões e adicionais habituais.`
    );
  } else {
    premissas.push(
      `A base de cálculo é o salário mensal informado (R$ ${formatarBRL(remuneracaoCentavos)}). ` +
      `Horas extras, comissões e adicionais habituais, se existirem, aumentam essa base e não foram informados.`
    );
  }

  // ── Aviso prévio e projeção do contrato ──────────────────────────────────
  const anosDeCasa = anosCompletos(admissao, saida);
  const diasAvisoIntegral = diasDeAvisoPrevio(params, regra, anosDeCasa);
  const diasAvisoDevidos = Math.round(diasAvisoIntegral * (regra.avisoPrevio.fator || 0));

  const devidoPeloEmpregador = regra.avisoPrevio.devidoPor === 'empregador';
  const devidoPeloEmpregado = regra.avisoPrevio.devidoPor === 'empregado';
  const avisoIndenizado = devidoPeloEmpregador && entrada.situacaoAviso === 'indenizado';

  const houveProjecao = avisoIndenizado && regra.avisoPrevio.projeta && diasAvisoDevidos > 0;
  const dataFim = houveProjecao ? somarDias(saida, diasAvisoDevidos) : saida;

  if (houveProjecao) {
    premissas.push(
      `O aviso prévio indenizado de ${diasAvisoDevidos} dias projeta o contrato até ${paraISO(dataFim)} ` +
      `para todos os efeitos legais (art. 487, §1º, da CLT; Súmula 371 do TST). Essa projeção pode gerar ` +
      `avos adicionais de 13º salário e de férias proporcionais.`
    );
  }
  if (entrada.modalidade === 'acordo' && houveProjecao) {
    alertas.push(
      'No acordo do art. 484-A da CLT o aviso indenizado é devido pela metade. A projeção desse período ' +
      'reduzido é controvertida: há empregadores que não projetam, o que altera os avos de 13º e de férias.'
    );
  }

  // ── 1. Saldo de salário ──────────────────────────────────────────────────
  const diasSaldo = saida.getUTCDate();
  if (regra.saldoSalario) {
    verbas.push({
      id: 'saldo_salario',
      rotulo: 'Saldo de salário',
      valor: centavosParaReais(porDia(diasSaldo)),
      devida: true,
      memoria: `${diasSaldo} ${diasSaldo === 1 ? 'dia trabalhado' : 'dias trabalhados'} no mês da saída ` +
        `(remuneração ÷ ${divisor} × ${diasSaldo}).`,
    });
  }

  // ── 2. Aviso prévio ──────────────────────────────────────────────────────
  if (devidoPeloEmpregador) {
    if (avisoIndenizado) {
      const rotulo = regra.avisoPrevio.fator === 1
        ? 'Aviso prévio indenizado'
        : `Aviso prévio indenizado (${Math.round(regra.avisoPrevio.fator * 100)}%)`;
      verbas.push({
        id: 'aviso_previo_indenizado',
        rotulo,
        valor: centavosParaReais(porDia(diasAvisoDevidos)),
        devida: true,
        memoria: regra.avisoPrevio.fator === 1
          ? `${diasAvisoIntegral} dias: 30 dias mais ${params.avisoPrevio.diasAdicionaisPorAnoCompleto} ` +
            `por ano completo de casa (${anosDeCasa} ${anosDeCasa === 1 ? 'ano' : 'anos'}), limitados a ` +
            `${params.avisoPrevio.diasMaximo} dias.`
          : `Metade do aviso de ${diasAvisoIntegral} dias = ${diasAvisoDevidos} dias (art. 484-A, I, da CLT).`,
      });
    } else {
      verbas.push({
        id: 'aviso_previo_trabalhado',
        rotulo: 'Aviso prévio trabalhado',
        valor: 0,
        devida: false,
        memoria: `${diasAvisoIntegral} dias de aviso.`,
        motivoNaoDevida:
          'Cumprido em serviço: os dias do aviso são pagos como salário normal do período, e não como verba ' +
          'rescisória. Durante o aviso trabalhado a jornada é reduzida em 2 horas por dia, ou o contrato ' +
          'termina 7 dias antes, à escolha do empregado (art. 488 da CLT).',
      });
      premissas.push(
        'Como o aviso prévio foi trabalhado, informe como data de saída o ÚLTIMO dia do aviso — é essa data ' +
        'que encerra o contrato e define os avos de 13º e de férias.'
      );
    }
  } else if (devidoPeloEmpregado) {
    if (entrada.situacaoAviso === 'nao_cumprido') {
      descontos.push({
        id: 'aviso_previo_nao_cumprido',
        rotulo: 'Aviso prévio não cumprido',
        valor: centavosParaReais(porDia(diasAvisoDevidos)),
        memoria: `${diasAvisoDevidos} dias descontados: quem pede demissão e não cumpre o aviso indeniza o ` +
          `empregador nesse valor (art. 487, §2º, da CLT). A proporcionalidade da Lei 12.506/2011 beneficia ` +
          `apenas o empregado, então o desconto fica em 30 dias.`,
      });
    } else if (entrada.situacaoAviso === 'dispensado') {
      premissas.push('O empregador dispensou o cumprimento do aviso prévio, então não há desconto por esse motivo.');
    }
  } else {
    verbas.push({
      id: 'aviso_previo',
      rotulo: 'Aviso prévio',
      valor: 0,
      devida: false,
      memoria: '—',
      motivoNaoDevida: 'Não é devido na dispensa por justa causa.',
    });
  }

  // ── 3. 13º salário proporcional ──────────────────────────────────────────
  const diasMinAvo = params.decimoTerceiro.diasMinimosParaAvo;
  const inicioAno = new Date(Date.UTC(saida.getUTCFullYear(), 0, 1));
  const inicio13 = admissao.getTime() > inicioAno.getTime() ? admissao : inicioAno;
  const fimAno = new Date(Date.UTC(saida.getUTCFullYear(), 11, 31));
  const fim13NoAno = dataFim.getTime() < fimAno.getTime() ? dataFim : fimAno;

  let avos13 = Math.min(12, contarAvos(inicio13, fim13NoAno, diasMinAvo));
  let avos13AnoSeguinte = 0;
  if (dataFim.getUTCFullYear() > saida.getUTCFullYear()) {
    const inicioProx = new Date(Date.UTC(dataFim.getUTCFullYear(), 0, 1));
    avos13AnoSeguinte = Math.min(12, contarAvos(inicioProx, dataFim, diasMinAvo));
  }
  const avos13Total = avos13 + avos13AnoSeguinte;

  if (regra.decimoTerceiroProporcional) {
    verbas.push({
      id: 'decimo_terceiro_proporcional',
      rotulo: '13º salário proporcional',
      valor: centavosParaReais(porAvo(avos13Total)),
      devida: true,
      memoria: avos13AnoSeguinte > 0
        ? `${avos13}/12 avos de ${saida.getUTCFullYear()} mais ${avos13AnoSeguinte}/12 avos de ` +
          `${dataFim.getUTCFullYear()}, gerados pela projeção do aviso. Conta-se um avo por mês com ao ` +
          `menos ${diasMinAvo} dias trabalhados.`
        : `${avos13Total}/12 avos: um avo por mês do ano com ao menos ${diasMinAvo} dias trabalhados.`,
    });
  } else {
    verbas.push({
      id: 'decimo_terceiro_proporcional',
      rotulo: '13º salário proporcional',
      valor: 0,
      devida: false,
      memoria: '—',
      motivoNaoDevida: 'Não é devido na dispensa por justa causa (art. 3º da Lei nº 4.090/1962).',
    });
  }

  // ── 4. Férias vencidas ───────────────────────────────────────────────────
  const feriasVencidasCentavos = regra.feriasVencidas ? remuneracaoCentavos * periodosVencidos : 0;
  if (periodosVencidos > 0) {
    verbas.push({
      id: 'ferias_vencidas_indenizadas',
      rotulo: 'Férias vencidas',
      valor: centavosParaReais(feriasVencidasCentavos),
      devida: regra.feriasVencidas,
      memoria: `${periodosVencidos} ${periodosVencidos === 1 ? 'período aquisitivo completo e não gozado' : 'períodos aquisitivos completos e não gozados'}, ` +
        `a uma remuneração cada.`,
      ...(regra.feriasVencidas ? {} : { motivoNaoDevida: 'Não devida nesta modalidade.' }),
    });
    if (regra.feriasVencidas && entrada.modalidade === 'justa_causa') {
      premissas.push(
        'Mesmo na justa causa as férias já vencidas e não gozadas continuam devidas, acrescidas de um terço ' +
        '(Súmula 171 do TST). O que se perde são as férias proporcionais.'
      );
    }
  }

  // ── 5. Férias proporcionais ──────────────────────────────────────────────
  const inicioPA = inicioPeriodoAquisitivo(admissao, dataFim);
  const avosFerias = Math.min(12, contarAvos(inicioPA, dataFim, diasMinAvo));
  const feriasPropCentavos = regra.feriasProporcionais ? porAvo(avosFerias) : 0;

  if (regra.feriasProporcionais) {
    verbas.push({
      id: 'ferias_proporcionais_indenizadas',
      rotulo: 'Férias proporcionais',
      valor: centavosParaReais(feriasPropCentavos),
      devida: true,
      memoria: `${avosFerias}/12 avos do período aquisitivo iniciado em ${paraISO(inicioPA)}.`,
    });
    if (avosFerias >= 12) {
      alertas.push(
        'O período aquisitivo de férias se completou na data final do contrato. Confira se esse período já ' +
        'foi informado como "férias vencidas", para não contá-lo duas vezes.'
      );
    }
  } else {
    verbas.push({
      id: 'ferias_proporcionais_indenizadas',
      rotulo: 'Férias proporcionais',
      valor: 0,
      devida: false,
      memoria: `Seriam ${avosFerias}/12 avos.`,
      motivoNaoDevida: 'Não são devidas na dispensa por justa causa (Súmula 171 do TST).',
    });
  }

  // ── 6. Um terço constitucional ───────────────────────────────────────────
  const fracao = params.ferias.adicionalFracao;
  const baseTerco = feriasVencidasCentavos + feriasPropCentavos;
  const tercoCentavos = Math.round((baseTerco * fracao.numerador) / fracao.denominador);
  if (baseTerco > 0) {
    verbas.push({
      id: 'terco_ferias_indenizadas',
      rotulo: `Adicional de ${fracao.numerador}/${fracao.denominador} sobre as férias`,
      valor: centavosParaReais(tercoCentavos),
      devida: true,
      memoria: `${fracao.numerador}/${fracao.denominador} sobre as férias vencidas e proporcionais ` +
        `(art. 7º, XVII, da Constituição).`,
    });
  }

  // ── Total bruto ──────────────────────────────────────────────────────────
  const totalBrutoCentavos = verbas.reduce((s, v) => s + (v.devida ? reaisParaCentavos(v.valor) : 0), 0);

  // ── FGTS ─────────────────────────────────────────────────────────────────
  const aliqFGTS = params.fgts.aliquotaDepositoPct;
  const baseDepositoRescisorio = verbas
    .filter((v) => v.devida && params.fgts.incideSobreVerbas.includes(v.id))
    .reduce((s, v) => s + reaisParaCentavos(v.valor), 0);
  const depositoRescisorio = Math.round((baseDepositoRescisorio * aliqFGTS) / 100);

  const saldoInformado = entrada.saldoFGTSInformado != null;
  let saldoBaseCentavos;
  if (saldoInformado) {
    saldoBaseCentavos = reaisParaCentavos(/** @type {number} */ (entrada.saldoFGTSInformado));
  } else {
    const mesesContrato = Math.max(0, mesesEntre(admissao, dataFim));
    saldoBaseCentavos = Math.round((remuneracaoCentavos * aliqFGTS * mesesContrato) / 100);
    alertas.push(
      'O saldo do FGTS não foi informado, então foi estimado como 8% da remuneração por mês de contrato. ' +
      'Essa estimativa ignora correção monetária, rendimentos, saques anteriores e variações de salário — ' +
      'consulte o saldo real no aplicativo do FGTS para um número confiável.'
    );
    premissas.push(
      `Saldo do FGTS estimado sobre ${mesesContrato} ${mesesContrato === 1 ? 'mês' : 'meses'} de contrato, ` +
      `à alíquota de ${aliqFGTS}% da remuneração atual.`
    );
  }

  const baseMulta = saldoBaseCentavos + depositoRescisorio;
  const multaCentavos = Math.round((baseMulta * regra.multaFGTSPct) / 100);
  const saqueCentavos = Math.round((baseMulta * regra.saqueFGTSPct) / 100);
  const disponivelCentavos = saqueCentavos + multaCentavos;

  /** @type {import('./rescisao-tipos.js').BlocoFGTS} */
  const fgts = {
    saldoBase: centavosParaReais(saldoBaseCentavos),
    saldoEstimado: !saldoInformado,
    depositoRescisorio: centavosParaReais(depositoRescisorio),
    multaPct: regra.multaFGTSPct,
    multaValor: centavosParaReais(multaCentavos),
    saquePct: regra.saqueFGTSPct,
    valorDisponivelSaque: centavosParaReais(disponivelCentavos),
    observacao: regra.saqueFGTSPct > 0
      ? `Nesta modalidade o saque é de ${regra.saqueFGTSPct}% do saldo, e a multa de ${regra.multaFGTSPct}% ` +
        `é liberada integralmente. O FGTS é pago pela conta vinculada, não pelo empregador na rescisão.`
      : 'Nesta modalidade não há multa nem liberação do saque por causa da rescisão. O saldo permanece na ' +
        'conta vinculada e só pode ser movimentado nas hipóteses do art. 20 da Lei nº 8.036/1990.',
  };

  // ── Descontos fiscais ────────────────────────────────────────────────────
  const podeCalcularFiscais = temTabelaINSS(params) && temTabelaIRRF(params);
  if (podeCalcularFiscais) {
    /** Soma das verbas devidas cuja incidência para `tributo` é true. */
    const baseDe = (/** @type {'inss'|'irrf'} */ tributo, /** @type {boolean} */ exclusiva) =>
      verbas
        .filter((v) => {
          if (!v.devida) return false;
          const inc = params.incidencias[v.id];
          if (!inc || inc[tributo] !== true) return false;
          return !!inc.tributacaoExclusiva === exclusiva;
        })
        .reduce((s, v) => s + reaisParaCentavos(v.valor), 0);

    const baseINSSMensal = baseDe('inss', false);
    const baseINSS13 = baseDe('inss', true);
    const inssMensal = calcularINSS(baseINSSMensal, params);
    const inss13 = calcularINSS(baseINSS13, params);
    if (inssMensal + inss13 > 0) {
      descontos.push({
        id: 'inss',
        rotulo: 'INSS',
        valor: centavosParaReais(inssMensal + inss13),
        memoria: inss13 > 0
          ? 'Calculado em separado sobre as verbas salariais e sobre o 13º salário, que tem incidência própria.'
          : 'Calculado por faixas progressivas sobre as verbas de natureza salarial.',
      });
    }

    const baseIRRFMensal = baseDe('irrf', false);
    const baseIRRF13 = baseDe('irrf', true);
    const irrfMensal = calcularIRRF(baseIRRFMensal, inssMensal, dependentes, params);
    const irrf13 = calcularIRRF(baseIRRF13, inss13, dependentes, params);
    if (irrfMensal + irrf13 > 0) {
      descontos.push({
        id: 'irrf',
        rotulo: 'Imposto de renda retido na fonte',
        valor: centavosParaReais(irrfMensal + irrf13),
        memoria: 'Férias indenizadas e o respectivo terço não entram na base (Súmula 386 do STJ). ' +
          'O 13º é tributado exclusivamente na fonte, em separado.',
      });
    }
    premissas.push(
      `Descontos de INSS e IRRF calculados pelas tabelas de ${params.tabelaINSS.competencia || 'competência informada'} ` +
      `nos parâmetros do simulador.`
    );
  } else {
    alertas.push(
      'Os descontos de INSS e de imposto de renda não foram estimados nesta versão: as tabelas vigentes ainda ' +
      'estão em conferência pelo escritório. O valor apresentado é BRUTO e o líquido efetivo será menor.'
    );
    premissas.push(
      'O resultado não inclui INSS nem imposto de renda. Não incidem sobre as férias indenizadas e o respectivo ' +
      'terço (Súmula 386 do STJ) nem, quanto ao INSS, sobre o aviso prévio indenizado (Tema 478 do STJ); ' +
      'incidem, em regra, sobre o saldo de salário e o 13º.'
    );
  }

  const totalDescontosCentavos = descontos.reduce((s, d) => s + reaisParaCentavos(d.valor), 0);
  const liquidoCentavos = totalBrutoCentavos - totalDescontosCentavos;

  // ── Seguro-desemprego e prazo ────────────────────────────────────────────
  const seguroDesemprego = {
    direito: regra.seguroDesemprego,
    texto: regra.seguroDesemprego
      ? 'Há direito ao seguro-desemprego, se preenchidos os requisitos de tempo de vínculo e de carência ' +
        'entre solicitações (Lei nº 7.998/1990). O benefício é requerido junto ao governo federal, não ao empregador.'
      : entrada.modalidade === 'acordo'
        ? 'O acordo do art. 484-A da CLT não autoriza o seguro-desemprego (§ 2º do próprio artigo).'
        : 'Não há direito ao seguro-desemprego nesta modalidade de rescisão.',
  };

  const prazoPagamento = {
    dias: params.prazoPagamento.dias,
    texto: `O pagamento das verbas rescisórias deve ocorrer em até ${params.prazoPagamento.dias} dias ` +
      `contados do ${params.prazoPagamento.contadoDe} (art. 477, §6º, da CLT). O atraso gera multa de ` +
      `${params.prazoPagamento.multaAtraso} (art. 477, §8º).`,
  };

  if (saida.getTime() > hoje.getTime()) {
    premissas.push('A data de saída informada ainda não ocorreu: o cálculo projeta a situação nessa data futura.');
  }

  alertas.push(
    'Este cálculo não inclui parcelas que dependem do seu contrato ou da convenção coletiva, como adicionais ' +
    'de insalubridade, periculosidade e noturno, horas extras não pagas, descanso semanal remunerado sobre ' +
    'variáveis, vale-transporte, plano de saúde, multas normativas e estabilidades.'
  );

  return {
    modalidade: entrada.modalidade,
    rotuloModalidade: regra.rotulo,
    remuneracaoBase: centavosParaReais(remuneracaoCentavos),
    avisoPrevioDias: diasAvisoDevidos,
    dataFimProjetada: paraISO(dataFim),
    houveProjecao,
    anosDeCasa,
    verbas,
    totalBruto: centavosParaReais(totalBrutoCentavos),
    descontos,
    totalDescontos: centavosParaReais(totalDescontosCentavos),
    liquidoEstimado: centavosParaReais(liquidoCentavos),
    descontosFiscaisCalculados: podeCalcularFiscais,
    fgts,
    totalGeralEstimado: centavosParaReais(liquidoCentavos + disponivelCentavos),
    seguroDesemprego,
    prazoPagamento,
    alertas,
    premissas,
  };
}
