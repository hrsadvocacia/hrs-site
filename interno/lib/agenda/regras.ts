/**
 * Agenda: logística de deslocamento entre as praças do escritório.
 *
 * O escritório atua em Goiânia/GO, Teresina/PI e Timon/MA. Audiência em praça
 * diferente da unidade do responsável exige passagem, hospedagem ou
 * substabelecimento — e isso se resolve com quinze dias, não com dois.
 */
import type { DataISO } from "../prazos/dias.ts";

export type Unidade = "GOIANIA" | "TERESINA" | "TIMON";

export const SEDE_DA_UNIDADE: Readonly<Record<Unidade, { municipio: string; uf: string }>> = {
  GOIANIA: { municipio: "Goiânia", uf: "GO" },
  TERESINA: { municipio: "Teresina", uf: "PI" },
  TIMON: { municipio: "Timon", uf: "MA" },
};

function chave(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Deslocamento é exigido quando o município do compromisso não é a sede da
 * unidade do responsável. Timon e Teresina são conurbadas (ponte sobre o
 * Parnaíba): quem está em uma atende a outra sem viagem.
 */
export function exigeDeslocamento(
  compromisso: { municipio: string; uf: string; virtual: boolean },
  unidadeResponsavel: Unidade,
): boolean {
  if (compromisso.virtual) return false;
  const sede = SEDE_DA_UNIDADE[unidadeResponsavel];
  const mesmoMunicipio =
    chave(compromisso.municipio) === chave(sede.municipio) &&
    compromisso.uf.toUpperCase() === sede.uf;
  if (mesmoMunicipio) return false;

  const conurbadas = new Set(["teresina/pi", "timon/ma"]);
  const alvo = `${chave(compromisso.municipio)}/${compromisso.uf.toLowerCase()}`;
  const origem = `${chave(sede.municipio)}/${sede.uf.toLowerCase()}`;
  if (conurbadas.has(alvo) && conurbadas.has(origem)) return false;

  return true;
}

export const ANTECEDENCIA_LOGISTICA_DIAS = 15;

export interface AlertaLogistica<T> {
  compromisso: T;
  diasRestantes: number;
}

/**
 * Compromissos com deslocamento nos próximos 15 dias corridos, ainda
 * agendados. Ordenados do mais próximo ao mais distante.
 */
export function alertasDeLogistica<T extends { dataHora: Date; status: string; exigeDeslocamento: boolean }>(
  compromissos: readonly T[],
  hoje: DataISO,
): AlertaLogistica<T>[] {
  const inicioHoje = Date.parse(`${hoje}T00:00:00Z`);
  const alertas: AlertaLogistica<T>[] = [];
  for (const c of compromissos) {
    if (c.status !== "AGENDADO" || !c.exigeDeslocamento) continue;
    const dias = Math.floor((c.dataHora.getTime() - inicioHoje) / 86_400_000);
    if (dias >= 0 && dias <= ANTECEDENCIA_LOGISTICA_DIAS) {
      alertas.push({ compromisso: c, diasRestantes: dias });
    }
  }
  return alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);
}
