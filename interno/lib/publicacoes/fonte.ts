/**
 * Fontes de publicação — a fronteira que isola o resto do sistema do formato
 * de cada diário.
 *
 * Tudo abaixo desta linha (deduplicação, triagem, vinculação, fila de órfãs)
 * trabalha sobre `PublicacaoNormalizada` e NÃO conhece DJEN, DEJT nem nenhum
 * outro. Trocar de fonte, ou acrescentar uma segunda para conferência, é
 * escrever um adaptador — não mexer no miolo.
 *
 * O `payloadBruto` viaja sempre. É o que permite reconstituir, meses depois,
 * exatamente o que a fonte disse — inclusive quando o adaptador estiver errado.
 */
import type { DataISO } from "../prazos/dias.ts";

export type IdFonte = "DJEN" | "DEJT" | "DOMICILIO_JUDICIAL" | "MANUAL";

/** Uma publicação já traduzida para o vocabulário do sistema. */
export interface PublicacaoNormalizada {
  fonte: IdFonte;
  /** Data de disponibilização no diário. É dela que sai a publicação legal. */
  dataDisponibilizacao: DataISO;
  /**
   * Número do processo como veio da fonte, em qualquer formato. A validação e
   * a normalização acontecem na triagem, não aqui: o adaptador não julga.
   */
  numeroProcesso?: string | undefined;
  /** Teor integral da comunicação. */
  teor: string;
  /** Nome do advogado como a fonte escreveu — base da detecção de homônimo. */
  nomeAdvogadoCitado?: string | undefined;
  numeroOabCitado?: string | undefined;
  ufOabCitada?: string | undefined;
  urlCertidao?: string | undefined;
  /** O que a fonte respondeu, sem tradução. Nunca descartado. */
  payloadBruto: unknown;
}

export interface ConsultaFonte {
  numeroOab: string;
  ufOab: string;
  /** Intervalo de disponibilização, inclusive nas duas pontas. */
  de: DataISO;
  ate: DataISO;
}

export interface ResultadoConsulta {
  publicacoes: PublicacaoNormalizada[];
  /**
   * Resposta válida e vazia é resultado, não falha — mas é resultado que
   * exige confirmação humana. Quem decide isso é o orquestrador.
   */
  consultaBemSucedida: true;
}

export interface FontePublicacao {
  readonly id: IdFonte;
  readonly nome: string;
  /**
   * Consulta a fonte. Deve LANÇAR em qualquer situação de dúvida — resposta
   * inesperada, formato desconhecido, erro de rede. Devolver lista vazia
   * diante de uma resposta que não se entendeu seria transformar falha em
   * "não há publicações", que é o pior desfecho possível neste sistema.
   */
  consultar(consulta: ConsultaFonte): Promise<ResultadoConsulta>;
}

/** Falha de consulta. Sempre visível: nunca vira lista vazia. */
export class FalhaNaFonteError extends Error {
  readonly fonte: IdFonte;
  readonly httpStatus: number | undefined;

  constructor(fonte: IdFonte, mensagem: string, httpStatus?: number) {
    super(`[${fonte}] ${mensagem}`);
    this.name = "FalhaNaFonteError";
    this.fonte = fonte;
    this.httpStatus = httpStatus;
  }
}

/**
 * O adaptador existe, mas o contrato da fonte ainda não foi verificado contra
 * uma resposta real. Erro dedicado para que essa situação NUNCA seja confundida
 * com "a fonte não tinha publicações".
 */
export class ContratoNaoVerificadoError extends Error {
  readonly fonte: IdFonte;

  constructor(fonte: IdFonte, comoResolver: string) {
    super(
      `O contrato da fonte ${fonte} ainda não foi verificado contra uma ` +
        `resposta real, então o adaptador se recusa a interpretar o retorno. ` +
        comoResolver,
    );
    this.name = "ContratoNaoVerificadoError";
    this.fonte = fonte;
  }
}
