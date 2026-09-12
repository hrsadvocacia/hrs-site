/**
 * Variáveis de template — `{{nome}}` — e o catálogo fechado por categoria.
 *
 * O catálogo é fechado de propósito: um template que aceitasse `{{valor_da_causa}}`
 * ou `{{previsao}}` seria a porta de entrada da promessa que a validação de
 * texto fixo barrou.
 */
import type { Violacao } from "./compliance.ts";

export type Categoria =
  | "RECEBIMENTO_DOCUMENTO"
  | "AUDIENCIA_DESIGNADA"
  | "MOVIMENTACAO_PROCESSO"
  | "CONVITE_REUNIAO"
  | "COBRANCA_PARCELA";

const COMUNS = ["nome", "primeiro_nome", "escritorio", "unidade", "advogado", "telefone_escritorio"] as const;

export const VARIAVEIS_POR_CATEGORIA: Readonly<Record<Categoria, readonly string[]>> = {
  RECEBIMENTO_DOCUMENTO: [...COMUNS, "documento", "data_recebimento"],
  AUDIENCIA_DESIGNADA: [...COMUNS, "processo", "data_audiencia", "hora_audiencia", "local", "orientacoes"],
  MOVIMENTACAO_PROCESSO: [...COMUNS, "processo", "data_movimentacao", "resumo_movimentacao"],
  CONVITE_REUNIAO: [...COMUNS, "data_reuniao", "hora_reuniao", "local", "assunto"],
  // "valor" aqui é o valor da PARCELA DE HONORÁRIO contratada — dívida líquida
  // e certa do cliente, não estimativa de quanto ele vai receber.
  COBRANCA_PARCELA: [...COMUNS, "numero_parcela", "valor", "vencimento", "forma_pagamento"],
};

export const CATEGORIAS: readonly Categoria[] = Object.keys(VARIAVEIS_POR_CATEGORIA) as Categoria[];

const PADRAO_VARIAVEL = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function extrairVariaveis(corpo: string): string[] {
  const nomes = new Set<string>();
  for (const m of corpo.matchAll(PADRAO_VARIAVEL)) nomes.add(m[1]!);
  return [...nomes];
}

/** Variáveis usadas no corpo que não pertencem ao catálogo da categoria. */
export function variaveisIndevidas(corpo: string, categoria: Categoria): Violacao[] {
  const permitidas = new Set<string>(VARIAVEIS_POR_CATEGORIA[categoria]);
  return extrairVariaveis(corpo)
    .filter((v) => !permitidas.has(v))
    .map((v) => ({
      tipo: "VALOR_CERTO" as const,
      trecho: `{{${v}}}`,
      explicacao:
        `A variável {{${v}}} não existe para a categoria. Permitidas: ` +
        VARIAVEIS_POR_CATEGORIA[categoria].map((p) => `{{${p}}}`).join(", ") + ".",
    }));
}

export class VariavelAusenteError extends Error {
  readonly variavel: string;
  constructor(variavel: string) {
    super(`A variável {{${variavel}}} não foi preenchida.`);
    this.name = "VariavelAusenteError";
    this.variavel = variavel;
  }
}

/** Substitui as variáveis. Lança se alguma ficar sem valor — mensagem com "{{nome}}" nunca sai. */
export function renderizar(corpo: string, valores: Readonly<Record<string, string>>): string {
  return corpo.replace(PADRAO_VARIAVEL, (_, nome: string) => {
    const v = valores[nome];
    if (v === undefined || v.trim() === "") throw new VariavelAusenteError(nome);
    return v;
  });
}
