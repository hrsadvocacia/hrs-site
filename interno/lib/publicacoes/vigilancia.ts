/**
 * Vigilância da captura e do Domicílio Judicial — regra PURA.
 *
 * Responde a pergunta que o painel precisa fazer todo dia: **o que deveria ter
 * acontecido e não aconteceu?**
 *
 * A pergunta é essa, e não "o que falhou". Falha grava linha de erro; ausência
 * não grava nada. Um cron que parou de disparar é invisível para qualquer
 * desenho que só examine registros existentes — por isso o que se compara aqui
 * é o ESPERADO contra o OBSERVADO.
 */
import { diferencaEmDias, fimDeSemana, type DataISO } from "../prazos/dias.ts";

export type SituacaoDia =
  | "OK"
  | "SEM_REGISTRO"
  | "NAO_CONCLUIDA"
  | "FALHA"
  | "AGUARDA_CONFIRMACAO";

export interface BatimentoObservado {
  data: DataISO;
  inscricaoOabId: string;
  status:
    | "PENDENTE"
    | "EM_EXECUCAO"
    | "CONCLUIDA"
    | "CONCLUIDA_SEM_PUBLICACOES"
    | "FALHA";
  confirmadaPorId: string | null;
}

export interface PendenciaCaptura {
  data: DataISO;
  inscricaoOabId: string;
  situacao: Exclude<SituacaoDia, "OK">;
  motivo: string;
}

/**
 * Último dia útil até a data dada (ela mesma, se for útil).
 *
 * A conferência do Domicílio é sempre POR DIA ÚTIL. Sem isto, quem confirma
 * num sábado registra um dia que a vigilância não cobra, e o contador de
 * atraso não baixa — o usuário conclui, com razão, que o sistema está quebrado.
 */
export function ultimoDiaUtil(ate: DataISO): DataISO {
  let d = ate;
  for (let i = 0; i < 7 && fimDeSemana(d); i++) {
    const dt = new Date(`${d}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - 1);
    d = dt.toISOString().slice(0, 10);
  }
  return d;
}

/** Dias úteis do intervalo, do mais antigo ao mais recente. Bordas inclusas. */
export function diasUteisNoIntervalo(de: DataISO, ate: DataISO): DataISO[] {
  const dias: DataISO[] = [];
  const total = diferencaEmDias(de, ate);
  for (let i = 0; i <= total; i++) {
    const d = new Date(`${de}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (!fimDeSemana(iso)) dias.push(iso);
  }
  return dias;
}

/**
 * Compara o esperado com o observado.
 *
 * Fim de semana não é cobrado: não há disponibilização em diário. Feriado ainda
 * é cobrado de propósito — é melhor uma pendência a mais para dispensar do que
 * um dia de captura perdido em silêncio.
 */
export function pendenciasDeCaptura(params: {
  inscricoesMonitoradas: readonly string[];
  batimentos: readonly BatimentoObservado[];
  de: DataISO;
  ate: DataISO;
}): PendenciaCaptura[] {
  const porChave = new Map<string, BatimentoObservado>();
  for (const b of params.batimentos) {
    porChave.set(`${b.data}|${b.inscricaoOabId}`, b);
  }

  const pendencias: PendenciaCaptura[] = [];
  for (const dia of diasUteisNoIntervalo(params.de, params.ate)) {
    for (const inscricaoOabId of params.inscricoesMonitoradas) {
      const b = porChave.get(`${dia}|${inscricaoOabId}`);

      if (!b) {
        pendencias.push({
          data: dia,
          inscricaoOabId,
          situacao: "SEM_REGISTRO",
          motivo:
            "Nenhuma captura foi sequer iniciada neste dia. O job pode não ter " +
            "disparado — ausência não gera log de erro.",
        });
        continue;
      }

      if (b.status === "FALHA") {
        pendencias.push({
          data: dia,
          inscricaoOabId,
          situacao: "FALHA",
          motivo: "A consulta à fonte falhou. Nenhuma publicação foi obtida.",
        });
      } else if (b.status === "PENDENTE" || b.status === "EM_EXECUCAO") {
        pendencias.push({
          data: dia,
          inscricaoOabId,
          situacao: "NAO_CONCLUIDA",
          motivo:
            "A captura começou e não terminou. Pode ter sido interrompida no meio.",
        });
      } else if (b.status === "CONCLUIDA_SEM_PUBLICACOES" && !b.confirmadaPorId) {
        pendencias.push({
          data: dia,
          inscricaoOabId,
          situacao: "AGUARDA_CONFIRMACAO",
          motivo:
            'A fonte respondeu sem publicações. "Não houve publicação" é uma ' +
            "afirmação e precisa de confirmação humana.",
        });
      }
    }
  }
  return pendencias;
}

// ---------------------------------------------------------------------------
// Domicílio Judicial Eletrônico — controle humano, sem integração
// ---------------------------------------------------------------------------

export interface ConfirmacaoDomicilio {
  data: DataISO;
  unidade: string;
  confirmadoEm: Date | null;
}

export interface PendenciaDomicilio {
  data: DataISO;
  unidade: string;
  diasUteisDeAtraso: number;
}

/**
 * Dias úteis sem confirmação de conferência do Domicílio Judicial.
 *
 * Citação e intimação com exigência de pessoalidade correm por ali e NÃO
 * aparecem no DJEN. Não há integração — é conferência humana. A função do
 * sistema é tornar a ausência dela visível, e não fingir que cobre o que não
 * cobre.
 */
export function pendenciasDeDomicilio(params: {
  unidades: readonly string[];
  confirmacoes: readonly ConfirmacaoDomicilio[];
  de: DataISO;
  ate: DataISO;
}): PendenciaDomicilio[] {
  const confirmadas = new Set(
    params.confirmacoes
      .filter((c) => c.confirmadoEm !== null)
      .map((c) => `${c.data}|${c.unidade}`),
  );

  const dias = diasUteisNoIntervalo(params.de, params.ate);
  const pendencias: PendenciaDomicilio[] = [];

  for (const unidade of params.unidades) {
    // Atraso contado do dia mais recente para trás: o painel precisa dizer
    // "há 3 dias úteis ninguém confere", não só listar datas soltas.
    let atraso = 0;
    for (let i = dias.length - 1; i >= 0; i--) {
      const dia = dias[i]!;
      if (confirmadas.has(`${dia}|${unidade}`)) break;
      atraso++;
      pendencias.push({ data: dia, unidade, diasUteisDeAtraso: atraso });
    }
  }
  return pendencias;
}

/** Mais de um dia útil sem conferência é alerta, conforme definido no produto. */
export const LIMITE_ATRASO_DOMICILIO = 1;

export function domicilioEmAlerta(pendencias: readonly PendenciaDomicilio[]): boolean {
  return pendencias.some((p) => p.diasUteisDeAtraso > LIMITE_ATRASO_DOMICILIO);
}

// ---------------------------------------------------------------------------
// Resumo para o painel
// ---------------------------------------------------------------------------

export interface ResumoPendencia {
  inscricaoOabId: string;
  situacao: Exclude<SituacaoDia, "OK">;
  dias: number;
  /** Dia mais antigo com esta pendência. */
  desde: DataISO;
  /** Dia mais recente com esta pendência. */
  ate: DataISO;
  motivo: string;
}

/**
 * Agrupa as pendências por inscrição e situação.
 *
 * Motivo: dez dias sem captura para três inscrições produzem trinta linhas
 * idênticas. Uma parede de texto repetido deixa de ser lida — e este é
 * justamente o aviso que não pode passar despercebido. O que o advogado
 * precisa saber é "a captura desta OAB está parada há 10 dias úteis", não a
 * enumeração de cada um deles.
 */
export function resumirPendencias(
  pendencias: readonly PendenciaCaptura[],
): ResumoPendencia[] {
  const grupos = new Map<string, PendenciaCaptura[]>();
  for (const p of pendencias) {
    const chave = `${p.inscricaoOabId}|${p.situacao}`;
    const atual = grupos.get(chave);
    if (atual) atual.push(p);
    else grupos.set(chave, [p]);
  }

  const resumos: ResumoPendencia[] = [];
  for (const itens of grupos.values()) {
    const datas = itens.map((i) => i.data).sort();
    resumos.push({
      inscricaoOabId: itens[0]!.inscricaoOabId,
      situacao: itens[0]!.situacao,
      dias: itens.length,
      desde: datas[0]!,
      ate: datas[datas.length - 1]!,
      motivo: itens[0]!.motivo,
    });
  }

  // Pior primeiro: mais dias em cima.
  return resumos.sort((a, b) => b.dias - a.dias);
}
