/**
 * Deduplicação de publicações — regra pura.
 *
 * A chave é (hash do teor, número do processo, data de disponibilização). O
 * hash é sobre o teor NORMALIZADO, porque a mesma comunicação pode voltar da
 * fonte com espaçamento ou quebra de linha diferentes entre um dia e outro, e
 * duas linhas idênticas na fila de triagem custam tempo de advogado.
 *
 * O banco reforça isso com índice único usando NULLS NOT DISTINCT — sem ele,
 * publicação órfã (sem número de processo) escaparia da deduplicação, que é
 * justamente o caso que mais se repete. Ver docs/DECISOES.md, D-0.7.
 */
import { createHash } from "node:crypto";
import { somenteDigitos } from "../documentos.ts";

/**
 * Normalização do teor antes do hash.
 *
 * NFC para que acentuação composta e pré-composta gerem o mesmo hash — a mesma
 * publicação vinda por caminhos diferentes tem que colidir. Espaços em branco
 * colapsados pelo mesmo motivo.
 */
export function normalizarTeor(teor: string): string {
  return teor.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function hashConteudo(teor: string): string {
  return createHash("sha256").update(normalizarTeor(teor), "utf8").digest("hex");
}

export interface ChaveDeduplicacao {
  hashConteudo: string;
  /** Somente dígitos, ou null quando a publicação é órfã. */
  numeroProcessoDigitos: string | null;
  dataDisponibilizacao: string;
}

export function chaveDeduplicacao(entrada: {
  teor: string;
  numeroProcesso?: string | null;
  dataDisponibilizacao: string;
}): ChaveDeduplicacao {
  const digitos = entrada.numeroProcesso
    ? somenteDigitos(entrada.numeroProcesso)
    : "";
  return {
    hashConteudo: hashConteudo(entrada.teor),
    numeroProcessoDigitos: digitos.length === 20 ? digitos : null,
    dataDisponibilizacao: entrada.dataDisponibilizacao.slice(0, 10),
  };
}

export function mesmaPublicacao(a: ChaveDeduplicacao, b: ChaveDeduplicacao): boolean {
  return (
    a.hashConteudo === b.hashConteudo &&
    a.numeroProcessoDigitos === b.numeroProcessoDigitos &&
    a.dataDisponibilizacao === b.dataDisponibilizacao
  );
}

/**
 * Remove duplicatas de um lote, preservando a ORDEM e a PRIMEIRA ocorrência.
 *
 * A fonte às vezes devolve a mesma comunicação duas vezes na mesma resposta —
 * paginação sobreposta, por exemplo. Deduplicar no lote evita depender de o
 * banco recusar uma a uma.
 */
export function deduplicarLote<T extends {
  teor: string;
  numeroProcesso?: string | null | undefined;
  dataDisponibilizacao: string;
}>(lote: readonly T[]): { unicas: T[]; descartadas: number } {
  const vistas = new Set<string>();
  const unicas: T[] = [];
  let descartadas = 0;

  for (const item of lote) {
    const chave = chaveDeduplicacao(item);
    const assinatura = `${chave.hashConteudo}|${chave.numeroProcessoDigitos ?? ""}|${chave.dataDisponibilizacao}`;
    if (vistas.has(assinatura)) {
      descartadas++;
      continue;
    }
    vistas.add(assinatura);
    unicas.push(item);
  }

  return { unicas, descartadas };
}
