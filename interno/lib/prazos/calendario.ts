/**
 * Calendario resolvido para UM orgao julgador.
 *
 * O motor nunca consulta o banco: recebe o calendario ja composto. Isso mantem
 * o motor puro e testavel, e deixa a composicao (feriado nacional + estadual da
 * UF do orgao + municipal do municipio do orgao + portaria do tribunal) num
 * lugar so, auditavel.
 *
 * A composicao a partir do Prisma vive em `composicao.ts` e NAO entra aqui.
 */
import { fimDeSemana, type DataISO, validarDataISO } from "./dias.ts";

export type OrigemDiaSemExpediente =
  | "FIM_DE_SEMANA"
  | "NACIONAL"
  | "ESTADUAL"
  | "MUNICIPAL"
  | "TRIBUNAL"
  | "RECESSO";

export interface DiaSemExpediente {
  data: DataISO;
  nome: string;
  origem: OrigemDiaSemExpediente;
  /** Ex.: "Lei 662/1949" ou "Portaria Conjunta 3/2026 — TRT-18". */
  fonte: string;
}

export interface Calendario {
  /**
   * Identificacao da versao usada. Gravada junto do prazo para que um
   * recalculo futuro nao apague o raciocinio que fundamentou a data.
   */
  readonly identificacao: string;
  /** Consulta um dia especifico. Nao inclui fim de semana nem recesso. */
  diaSemExpediente(data: DataISO): DiaSemExpediente | undefined;
}

export interface EntradaCalendario {
  data: string;
  nome: string;
  origem: Exclude<OrigemDiaSemExpediente, "FIM_DE_SEMANA" | "RECESSO">;
  fonte: string;
  /**
   * Ponto facultativo pode ou nao suspender expediente: quem decide e o ato do
   * tribunal. Entrada com `false` fica registrada mas NAO afeta a contagem.
   */
  suspendeExpediente?: boolean;
}

/**
 * Monta um calendario a partir de entradas ja filtradas para o orgao.
 *
 * Entradas com `suspendeExpediente: false` sao descartadas de proposito: elas
 * existem no cadastro para registrar que a data foi analisada e considerada
 * dia util, e tratar ponto facultativo como feriado faria o motor contar um dia
 * util a menos sem base legal.
 */
export function criarCalendario(
  identificacao: string,
  entradas: readonly EntradaCalendario[],
): Calendario {
  const porData = new Map<DataISO, DiaSemExpediente>();

  for (const entrada of entradas) {
    if (entrada.suspendeExpediente === false) continue;
    const data = validarDataISO(entrada.data);
    // A primeira entrada vence: a composicao empilha do mais especifico
    // (portaria do tribunal) para o mais geral (feriado nacional).
    if (!porData.has(data)) {
      porData.set(data, {
        data,
        nome: entrada.nome,
        origem: entrada.origem,
        fonte: entrada.fonte,
      });
    }
  }

  return {
    identificacao,
    diaSemExpediente: (data) => porData.get(data),
  };
}

/** Calendario sem nenhum feriado — util em teste e como fallback explicito. */
export const CALENDARIO_VAZIO: Calendario = criarCalendario("vazio", []);

/**
 * Ha expediente forense neste dia?
 *
 * Fim de semana nunca tem. O recesso NAO entra aqui porque depende do regime de
 * contagem: prazo penal, material e administrativo corre normalmente durante
 * ele. Quem decide isso e o motor.
 */
export function temExpediente(calendario: Calendario, data: DataISO): boolean {
  if (fimDeSemana(data)) return false;
  return calendario.diaSemExpediente(data) === undefined;
}
