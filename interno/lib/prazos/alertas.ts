/**
 * Escalonamento de alertas de prazo — regra PURA.
 *
 * Recebe a data de hoje por parâmetro em vez de ler o relógio, para que o
 * escalonamento de D-3 possa ser exercitado em teste sem esperar três dias.
 *
 * DUAS SITUAÇÕES QUE O PAINEL PRECISA GRITAR, e que são fáceis de esquecer:
 *
 *   1. Prazo PENDENTE_CONFERENCIA não é prazo controlado. Ele foi capturado,
 *      mas ninguém confirmou. Alerta de D-5 num prazo não conferido dá falsa
 *      sensação de controle — por isso pendente de conferência é sinalizado
 *      como tal, com prioridade própria, e não some na lista dos confirmados.
 *
 *   2. Prazo VENCIDO sem cumprimento registrado continua aparecendo. O sistema
 *      não encerra prazo sozinho: se a data passou e ninguém deu baixa, isso é
 *      exatamente o que o sócio precisa ver.
 */
import { diferencaEmDias, type DataISO } from "./dias.ts";

export type MarcoAlerta = "D_10" | "D_5" | "D_3" | "D_2" | "D_1" | "D_0";

/** Marcos em dias corridos até a data fatal. */
export const MARCOS: ReadonlyArray<{ marco: MarcoAlerta; dias: number }> = [
  { marco: "D_10", dias: 10 },
  { marco: "D_5", dias: 5 },
  { marco: "D_3", dias: 3 },
  { marco: "D_2", dias: 2 },
  { marco: "D_1", dias: 1 },
  { marco: "D_0", dias: 0 },
];

/** A partir deste marco, prazo sem tratativa registrada sobe para o sócio. */
export const MARCO_ESCALONAMENTO = 3;

export interface PrazoParaAlerta {
  id: string;
  dataFatal: DataISO;
  status:
    | "PENDENTE_CONFERENCIA"
    | "CONFIRMADO"
    | "EM_TRATATIVA"
    | "CUMPRIDO"
    | "PERDIDO"
    | "PREJUDICADO"
    | "CANCELADO";
  responsavelId: string;
  /** Sócio que recebe o escalonamento. Nulo = não há a quem escalar. */
  socioResponsavelId: string | null;
  /** Houve alguma tratativa registrada? */
  temTratativa: boolean;
  /** Marcos já disparados, para o cron ser idempotente. */
  marcosJaEnviados: readonly MarcoAlerta[];
}

export interface AlertaADisparar {
  prazoId: string;
  marco: MarcoAlerta;
  destinatarioId: string;
  /** Verdadeiro quando decorre de falta de tratativa a partir de D-3. */
  escalonamento: boolean;
  diasRestantes: number;
}

/** Status em que o prazo ainda corre e merece alerta. */
const ATIVOS = new Set(["PENDENTE_CONFERENCIA", "CONFIRMADO", "EM_TRATATIVA"]);

/**
 * Quais alertas devem ser disparados hoje.
 *
 * Dispara o marco MAIS PRÓXIMO ainda não enviado, e não todos os vencidos: se o
 * cron ficou dois dias fora do ar, o advogado recebe "faltam 3 dias", não uma
 * enxurrada de D-10 e D-5 já superados. O que ficou para trás continua visível
 * no painel.
 */
export function alertasDoDia(
  prazos: readonly PrazoParaAlerta[],
  hoje: DataISO,
): AlertaADisparar[] {
  const saida: AlertaADisparar[] = [];

  for (const prazo of prazos) {
    if (!ATIVOS.has(prazo.status)) continue;

    const restantes = diferencaEmDias(hoje, prazo.dataFatal);
    // Prazo vencido não gera alerta novo — gera pendência no painel, que é
    // outra coisa. Ver `prazosVencidosSemBaixa`.
    if (restantes < 0) continue;

    const enviados = new Set(prazo.marcosJaEnviados);
    const devido = MARCOS.filter(
      (m) => restantes <= m.dias && !enviados.has(m.marco),
    ).at(-1);
    if (!devido) continue;

    saida.push({
      prazoId: prazo.id,
      marco: devido.marco,
      destinatarioId: prazo.responsavelId,
      escalonamento: false,
      diasRestantes: restantes,
    });

    // Escalonamento: a partir de D-3, prazo sem tratativa registrada sobe para
    // o sócio. É um alerta ADICIONAL — o responsável continua recebendo o dele.
    if (
      restantes <= MARCO_ESCALONAMENTO &&
      !prazo.temTratativa &&
      prazo.socioResponsavelId &&
      prazo.socioResponsavelId !== prazo.responsavelId
    ) {
      saida.push({
        prazoId: prazo.id,
        marco: devido.marco,
        destinatarioId: prazo.socioResponsavelId,
        escalonamento: true,
        diasRestantes: restantes,
      });
    }
  }

  return saida;
}

/**
 * Prazos cuja data já passou sem cumprimento nem cancelamento registrados.
 *
 * O sistema NUNCA encerra prazo sozinho. Se a data passou e ninguém deu baixa,
 * ou o prazo foi cumprido e não registrado, ou foi perdido — as duas hipóteses
 * exigem gente olhando, e nenhuma delas pode sumir da tela.
 */
export function prazosVencidosSemBaixa(
  prazos: readonly PrazoParaAlerta[],
  hoje: DataISO,
): PrazoParaAlerta[] {
  return prazos.filter(
    (p) => ATIVOS.has(p.status) && diferencaEmDias(hoje, p.dataFatal) < 0,
  );
}

/** Prazos capturados que ainda aguardam conferência humana. */
export function pendentesDeConferencia(
  prazos: readonly PrazoParaAlerta[],
): PrazoParaAlerta[] {
  return prazos.filter((p) => p.status === "PENDENTE_CONFERENCIA");
}

export type Severidade = "vencido" | "hoje" | "critico" | "atencao" | "normal";

/**
 * Severidade para exibição. `PENDENTE_CONFERENCIA` nunca é "normal": prazo não
 * conferido é pendência mesmo faltando trinta dias.
 */
export function severidade(
  prazo: Pick<PrazoParaAlerta, "dataFatal" | "status">,
  hoje: DataISO,
): Severidade {
  const restantes = diferencaEmDias(hoje, prazo.dataFatal);
  if (restantes < 0) return "vencido";
  if (restantes === 0) return "hoje";
  if (restantes <= MARCO_ESCALONAMENTO) return "critico";
  if (restantes <= 10 || prazo.status === "PENDENTE_CONFERENCIA") return "atencao";
  return "normal";
}
