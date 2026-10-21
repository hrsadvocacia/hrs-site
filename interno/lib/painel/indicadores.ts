/**
 * Indicadores do painel do sócio — funções puras, para serem testáveis.
 *
 * A métrica que mais importa não é "quantos prazos cumprimos": é
 * `salvosNoLimite` — prazos cumpridos no próprio dia fatal. Um número alto ali
 * significa que o escritório está operando com a margem toda consumida, e que
 * a próxima falha de captura vira prazo perdido. É indicador de RISCO, não de
 * produtividade, e a tela diz isso.
 */
import type { DataISO } from "../prazos/dias.ts";

export interface PrazoParaIndicador {
  id: string;
  status: string;
  dataFatal: DataISO;
  cumpridoEm: DataISO | null;
  responsavelId: string;
  responsavelNome: string;
}

export interface CargaAdvogado {
  responsavelId: string;
  nome: string;
  emCurso: number;
  vencendoEm7Dias: number;
  pendentesConferencia: number;
  perdidos: number;
  salvosNoLimite: number;
}

const EM_CURSO = ["PENDENTE_CONFERENCIA", "CONFIRMADO", "EM_TRATATIVA"];

function diferenca(de: DataISO, ate: DataISO): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

export function cargaPorAdvogado(
  prazos: readonly PrazoParaIndicador[],
  hoje: DataISO,
): CargaAdvogado[] {
  const mapa = new Map<string, CargaAdvogado>();
  for (const p of prazos) {
    let c = mapa.get(p.responsavelId);
    if (!c) {
      c = {
        responsavelId: p.responsavelId,
        nome: p.responsavelNome,
        emCurso: 0,
        vencendoEm7Dias: 0,
        pendentesConferencia: 0,
        perdidos: 0,
        salvosNoLimite: 0,
      };
      mapa.set(p.responsavelId, c);
    }
    if (EM_CURSO.includes(p.status)) {
      c.emCurso++;
      const dias = diferenca(hoje, p.dataFatal);
      if (dias >= 0 && dias <= 7) c.vencendoEm7Dias++;
      if (p.status === "PENDENTE_CONFERENCIA") c.pendentesConferencia++;
    }
    if (p.status === "PERDIDO") c.perdidos++;
    if (p.status === "CUMPRIDO" && p.cumpridoEm && p.cumpridoEm === p.dataFatal) c.salvosNoLimite++;
  }
  return [...mapa.values()].sort((a, b) => b.emCurso - a.emCurso || a.nome.localeCompare(b.nome));
}

export interface ResumoRisco {
  emCurso: number;
  vencidosSemBaixa: number;
  pendentesConferencia: number;
  perdidos: number;
  salvosNoLimite: number;
}

export function resumoDeRisco(prazos: readonly PrazoParaIndicador[], hoje: DataISO): ResumoRisco {
  let emCurso = 0, vencidosSemBaixa = 0, pendentesConferencia = 0, perdidos = 0, salvosNoLimite = 0;
  for (const p of prazos) {
    if (EM_CURSO.includes(p.status)) {
      emCurso++;
      if (p.dataFatal < hoje) vencidosSemBaixa++;
      if (p.status === "PENDENTE_CONFERENCIA") pendentesConferencia++;
    }
    if (p.status === "PERDIDO") perdidos++;
    if (p.status === "CUMPRIDO" && p.cumpridoEm && p.cumpridoEm === p.dataFatal) salvosNoLimite++;
  }
  return { emCurso, vencidosSemBaixa, pendentesConferencia, perdidos, salvosNoLimite };
}

export interface EtapaFunil {
  etapa: string;
  quantidade: number;
}

/**
 * Funil de origem, de lead a cliente com processo. Só conta o que pode ser
 * contado: lead sem consentimento não é "oportunidade perdida", é gente que
 * não pediu para ser procurada.
 */
export function funil(params: {
  leadsComConsentimento: number;
  leadsEmContato: number;
  leadsConvertidos: number;
  clientesComProcesso: number;
}): EtapaFunil[] {
  return [
    { etapa: "Pediram contato", quantidade: params.leadsComConsentimento },
    { etapa: "Em contato", quantidade: params.leadsEmContato },
    { etapa: "Viraram cliente", quantidade: params.leadsConvertidos },
    { etapa: "Com processo ativo", quantidade: params.clientesComProcesso },
  ];
}

/** Percentual de conversão entre duas etapas, com denominador zero tratado. */
export function conversao(de: number, para: number): string {
  if (de === 0) return "—";
  return `${Math.round((para / de) * 100)}%`;
}
