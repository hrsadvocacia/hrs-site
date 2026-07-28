// @ts-check
/**
 * Utilitários compartilhados pelos simuladores (Precatório/RPV e Verbas
 * Rescisórias): classes de erro, aritmética de dinheiro em centavos e
 * manipulação de datas em UTC.
 *
 * Regra arquitetural: este módulo NÃO conhece DOM, rede nem parâmetros
 * legais. É puro e testável.
 *
 * @module simulador/comum
 */

// ─────────────────────────────────────────────────────────────────────────────
// Erros
// ─────────────────────────────────────────────────────────────────────────────

/** Entrada inválida fornecida pelo usuário (valor negativo, data futura, etc.). */
export class EntradaInvalidaError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'EntradaInvalidaError';
  }
}

/** Parâmetro legal obrigatório ainda PENDENTE no arquivo de parâmetros. */
export class ParametroPendenteError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'ParametroPendenteError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dinheiro (centavos inteiros)
// ─────────────────────────────────────────────────────────────────────────────

/** @param {number} reais @returns {number} centavos inteiros */
export function reaisParaCentavos(reais) {
  return Math.round(reais * 100);
}

/** @param {number} centavos @returns {number} reais com 2 casas */
export function centavosParaReais(centavos) {
  return Math.round(centavos) / 100;
}

/**
 * Formata centavos como texto monetário pt-BR (sem símbolo).
 * @param {number} centavos @returns {string}
 */
export function formatarBRL(centavos) {
  return centavosParaReais(centavos).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Datas (UTC, à prova de fuso)
// ─────────────────────────────────────────────────────────────────────────────

/** Milissegundos em um dia. */
export const UM_DIA_MS = 86400000;

/**
 * Converte 'YYYY-MM-DD' em Date (meia-noite UTC). Lança se a data for inválida.
 * @param {string} iso
 * @param {string} campo  nome do campo (para mensagem de erro)
 * @returns {Date}
 */
export function parseISO(iso, campo) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new EntradaInvalidaError(`Data inválida em "${campo}": esperado YYYY-MM-DD, recebido "${iso}".`);
  }
  const [a, m, d] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) {
    throw new EntradaInvalidaError(`Data inexistente em "${campo}": "${iso}".`);
  }
  return data;
}

/**
 * Meses inteiros de `de` até `ate` (calendário, não fração de 30 dias).
 * @param {Date} de @param {Date} ate @returns {number}
 */
export function mesesEntre(de, ate) {
  let meses = (ate.getUTCFullYear() - de.getUTCFullYear()) * 12 + (ate.getUTCMonth() - de.getUTCMonth());
  if (ate.getUTCDate() < de.getUTCDate()) meses -= 1;
  return meses;
}

/** Meia-noite UTC do mesmo dia. @param {Date} d @returns {Date} */
export function apenasData(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Soma dias de calendário a uma data (UTC).
 * @param {Date} d @param {number} dias @returns {Date}
 */
export function somarDias(d, dias) {
  return new Date(d.getTime() + dias * UM_DIA_MS);
}

/**
 * Anos completos de serviço entre duas datas (aniversários efetivamente
 * completados).
 * @param {Date} de @param {Date} ate @returns {number}
 */
export function anosCompletos(de, ate) {
  return Math.max(0, Math.floor(mesesEntre(de, ate) / 12));
}

/** Data ISO (YYYY-MM-DD) de um Date em UTC. @param {Date} d @returns {string} */
export function paraISO(d) {
  return d.toISOString().slice(0, 10);
}
