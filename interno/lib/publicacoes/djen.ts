/**
 * Adaptador do DJEN — Diário de Justiça Eletrônico Nacional.
 *
 * ESTADO: a montagem da consulta está pronta e testada. A LEITURA DA RESPOSTA
 * NÃO ESTÁ, de propósito.
 *
 * O contrato de retorno desta API nunca foi observado contra uma chamada real
 * a partir deste ambiente — a política de rede bloqueia a saída para
 * `comunicaapi.pje.jus.br`. Escrever o mapeamento por suposição produziria um
 * adaptador que compila, passa em teste com dado inventado e, em produção,
 * silenciosamente não casa nenhum processo: prazos deixariam de ser capturados
 * sem que nada acusasse erro. É o pior modo de falha possível aqui.
 *
 * COMO CONCLUIR, quando houver uma resposta real em mãos:
 *
 *   1. rode a consulta e guarde a resposta crua:
 *        curl -s "$(url impressa por montarUrl)" > amostra-djen.json
 *   2. escreva `mapear` a partir dos campos OBSERVADOS na amostra;
 *   3. guarde a amostra em lib/publicacoes/amostras/ e escreva um teste de
 *      contrato sobre ela — é ele que vai gritar quando a fonte mudar de forma;
 *   4. remova o `ContratoNaoVerificadoError`.
 *
 * Enquanto isso não acontece, o job de captura registra FALHA visível no
 * painel. Nunca "nenhuma publicação".
 */
import {
  ContratoNaoVerificadoError,
  FalhaNaFonteError,
  type ConsultaFonte,
  type FontePublicacao,
  type PublicacaoNormalizada,
  type ResultadoConsulta,
} from "./fonte.ts";

export const BASE_DJEN = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

/**
 * Monta a URL de consulta.
 *
 * Os nomes dos parâmetros são os documentados na consulta pública do DJEN
 * (`numeroOab`, `ufOab`, intervalo de disponibilização). Isto é a parte
 * verificável sem chamar a API — e está coberta por teste.
 */
export function montarUrl(consulta: ConsultaFonte, base = BASE_DJEN): string {
  const url = new URL(base);
  url.searchParams.set("numeroOab", consulta.numeroOab.replace(/\D/g, ""));
  url.searchParams.set("ufOab", consulta.ufOab.toUpperCase());
  url.searchParams.set("dataDisponibilizacaoInicio", consulta.de);
  url.searchParams.set("dataDisponibilizacaoFim", consulta.ate);
  return url.toString();
}

/**
 * Traduz a resposta bruta do DJEN para o vocabulário do sistema.
 *
 * NÃO IMPLEMENTADO — ver o cabeçalho deste arquivo. A assinatura já está no
 * lugar para que o restante da Fase 2 possa ser construído e testado em volta.
 */
export function mapear(_payloadBruto: unknown): PublicacaoNormalizada[] {
  throw new ContratoNaoVerificadoError(
    "DJEN",
    "Obtenha uma resposta real da API (ver instruções no cabeçalho de " +
      "lib/publicacoes/djen.ts) e escreva o mapeamento a partir dos campos " +
      "observados. Até lá, a captura do DJEN registra falha visível no painel " +
      "em vez de reportar ausência de publicações.",
  );
}

export class FonteDjen implements FontePublicacao {
  readonly id = "DJEN" as const;
  readonly nome = "DJEN — Diário de Justiça Eletrônico Nacional";

  private readonly base: string;
  private readonly tempoLimiteMs: number;

  constructor(opcoes: { base?: string; tempoLimiteMs?: number } = {}) {
    this.base = opcoes.base ?? BASE_DJEN;
    this.tempoLimiteMs = opcoes.tempoLimiteMs ?? 30_000;
  }

  async consultar(consulta: ConsultaFonte): Promise<ResultadoConsulta> {
    const url = montarUrl(consulta, this.base);
    const controlador = new AbortController();
    const alarme = setTimeout(() => controlador.abort(), this.tempoLimiteMs);

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        signal: controlador.signal,
        headers: { Accept: "application/json" },
      });
    } catch (e) {
      // Rede fora, DNS, tempo esgotado: falha VISÍVEL, nunca lista vazia.
      throw new FalhaNaFonteError(
        this.id,
        `Não foi possível consultar o DJEN: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      clearTimeout(alarme);
    }

    if (!resposta.ok) {
      throw new FalhaNaFonteError(
        this.id,
        `A consulta respondeu ${resposta.status}.`,
        resposta.status,
      );
    }

    let payloadBruto: unknown;
    try {
      payloadBruto = await resposta.json();
    } catch {
      throw new FalhaNaFonteError(this.id, "A resposta não é JSON válido.");
    }

    // Lança ContratoNaoVerificadoError enquanto o mapeamento não existir.
    return { publicacoes: mapear(payloadBruto), consultaBemSucedida: true };
  }
}
