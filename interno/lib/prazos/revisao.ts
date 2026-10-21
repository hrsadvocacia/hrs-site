/**
 * Revisão anual dos calendários dos tribunais.
 *
 * O motor de prazos só calcula com calendário VIGENTE. Todo ano, cada tribunal
 * publica portaria com suspensões de expediente e os feriados municipais mudam
 * de data. Um calendário do ano anterior não é "quase certo": é errado em dias
 * específicos, e cada dia errado é um prazo contado a mais ou a menos.
 *
 * Por isso a revisão é cobrada com antecedência — a partir de 1º de novembro
 * do ano anterior — e, passado o início do ano, vira pendência vermelha.
 */
import type { DataISO } from "./dias.ts";

export const MES_INICIO_COBRANCA = 11;

export type Urgencia = "ANTECIPADA" | "URGENTE" | "VENCIDA";

export interface RevisaoPendente {
  tribunalId: string;
  tribunalSigla: string;
  ano: number;
  urgencia: Urgencia;
  motivo: string;
}

export interface RevisaoObservada {
  tribunalId: string;
  tribunalSigla: string;
  ano: number;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";
  temCalendarioVigente: boolean;
}

/**
 * Quais revisões precisam de atenção hoje.
 *
 * - Novembro e dezembro: cobra a revisão do ano SEGUINTE (antecipada).
 * - Já dentro do ano, sem calendário vigente: VENCIDA — o motor recusa cálculo.
 * - Já dentro do ano, com calendário vigente mas revisão não concluída:
 *   URGENTE — está calculando com calendário que ninguém reconferiu.
 */
export function revisoesPendentes(
  observadas: readonly RevisaoObservada[],
  hoje: DataISO,
): RevisaoPendente[] {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  const pendentes: RevisaoPendente[] = [];

  for (const r of observadas) {
    if (r.status === "CONCLUIDA") continue;

    if (r.ano === ano) {
      pendentes.push(
        r.temCalendarioVigente
          ? {
              tribunalId: r.tribunalId,
              tribunalSigla: r.tribunalSigla,
              ano: r.ano,
              urgencia: "URGENTE",
              motivo:
                "O ano corrente está sendo calculado com um calendário que ainda não passou " +
                "pela revisão anual. Feriado municipal e portaria de suspensão mudam todo ano.",
            }
          : {
              tribunalId: r.tribunalId,
              tribunalSigla: r.tribunalSigla,
              ano: r.ano,
              urgencia: "VENCIDA",
              motivo:
                "Não há calendário vigente para o ano corrente. O motor RECUSA calcular prazo " +
                "deste tribunal até que um sócio aprove o calendário.",
            },
      );
      continue;
    }

    if (r.ano === ano + 1 && mes >= MES_INICIO_COBRANCA) {
      pendentes.push({
        tribunalId: r.tribunalId,
        tribunalSigla: r.tribunalSigla,
        ano: r.ano,
        urgencia: "ANTECIPADA",
        motivo:
          `O calendário de ${r.ano} precisa estar vigente antes de 1º de janeiro. As portarias ` +
          "de fim de ano costumam sair em novembro e dezembro.",
      });
    }
  }

  return pendentes.sort((a, b) => {
    const peso = { VENCIDA: 0, URGENTE: 1, ANTECIPADA: 2 } as const;
    return peso[a.urgencia] - peso[b.urgencia] || a.tribunalSigla.localeCompare(b.tribunalSigla);
  });
}

export function haRevisaoBloqueante(pendentes: readonly RevisaoPendente[]): boolean {
  return pendentes.some((p) => p.urgencia === "VENCIDA");
}
