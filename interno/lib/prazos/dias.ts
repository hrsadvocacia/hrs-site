/**
 * Aritmetica de datas para o motor de prazos.
 *
 * As datas circulam como string `AAAA-MM-DD` e toda conta e feita em UTC.
 * Motivo: `Date` local carrega fuso e horario de verao, e um prazo forense nao
 * tem hora — tem dia. Usar `Date` local faria o mesmo prazo mudar de dia
 * conforme o relogio do servidor, que e uma classe inteira de bug que este
 * modulo nao pode ter.
 */

/** Data civil no formato `AAAA-MM-DD`. */
export type DataISO = string;

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

export function validarDataISO(data: string): DataISO {
  if (!FORMATO.test(data)) {
    throw new Error(`Data inválida: "${data}". Use o formato AAAA-MM-DD.`);
  }
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita data que "existe" no formato mas nao no calendario (31/02, 30/02).
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    throw new Error(`Data inexistente no calendário: "${data}".`);
  }
  return data;
}

function paraDate(data: DataISO): Date {
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function paraISO(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

export function somarDias(data: DataISO, dias: number): DataISO {
  const d = paraDate(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraISO(d);
}

export function proximoDia(data: DataISO): DataISO {
  return somarDias(data, 1);
}

/** 0 = domingo ... 6 = sabado. */
export function diaDaSemana(data: DataISO): number {
  return paraDate(data).getUTCDay();
}

export function fimDeSemana(data: DataISO): boolean {
  const d = diaDaSemana(data);
  return d === 0 || d === 6;
}

export function ano(data: DataISO): number {
  return Number(data.slice(0, 4));
}

export function mes(data: DataISO): number {
  return Number(data.slice(5, 7));
}

export function dia(data: DataISO): number {
  return Number(data.slice(8, 10));
}

export function antes(a: DataISO, b: DataISO): boolean {
  return a < b;
}

export function depois(a: DataISO, b: DataISO): boolean {
  return a > b;
}

/** Diferenca em dias corridos entre duas datas (b - a). */
export function diferencaEmDias(a: DataISO, b: DataISO): number {
  return Math.round((paraDate(b).getTime() - paraDate(a).getTime()) / 86_400_000);
}

export function formatarBR(data: DataISO): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Recesso forense — 20 de dezembro a 20 de janeiro, INCLUSIVE.
// CLT art. 775-A (Lei 13.545/2017) e CPC art. 220.
// ---------------------------------------------------------------------------

export function noRecesso(data: DataISO): boolean {
  const m = mes(data);
  const d = dia(data);
  return (m === 12 && d >= 20) || (m === 1 && d <= 20);
}

/**
 * Primeiro dia apos o termino do recesso que contem `data`.
 *
 * Se a data esta em dezembro, o recesso termina em 20/01 do ano SEGUINTE; se
 * esta em janeiro, termina em 20/01 do proprio ano. Errar essa virada de ano e
 * o modo mais facil de calcular uma data fatal um ano inteiro fora do lugar.
 */
export function primeiroDiaAposRecesso(data: DataISO): DataISO {
  if (!noRecesso(data)) return data;
  const anoFim = mes(data) === 12 ? ano(data) + 1 : ano(data);
  return `${anoFim}-01-21`;
}
