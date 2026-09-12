/** Utilidades de data para telas. Datas de calendário circulam como ISO "aaaa-mm-dd" em UTC. */
import type { DataISO } from "@/lib/prazos/dias";

export function hojeISO(): DataISO {
  return new Date().toISOString().slice(0, 10);
}

export function iso(d: Date): DataISO {
  return d.toISOString().slice(0, 10);
}

/** Date do banco (coluna DATE, meia-noite UTC) -> "dd/mm/aaaa". */
export function dataBR(d: Date | null | undefined): string {
  if (!d) return "—";
  const [a, m, dia] = iso(d).split("-");
  return `${dia}/${m}/${a}`;
}

/** Instante -> "dd/mm/aaaa hh:mm" no fuso de Brasília. */
export function dataHoraBR(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/** "aaaa-mm-dd" -> Date à meia-noite UTC, para colunas DATE. */
export function dataUTC(isoData: string): Date {
  return new Date(`${isoData}T00:00:00Z`);
}

/** Campos <input type="datetime-local"> chegam sem fuso: interpretamos como Brasília (UTC-3). */
export function deDataHoraLocal(texto: string): Date {
  return new Date(`${texto}:00-03:00`);
}

/** Date -> valor para <input type="datetime-local"> em Brasília. */
export function paraDataHoraLocal(d: Date): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}
