/**
 * Regras puras de auditoria — sem I/O, sem Next, sem Prisma.
 *
 * Separado de `auditoria.ts` para poder ser testado como funcao pura, pelo
 * mesmo motivo que o motor de prazos sera: regra que so da para exercitar
 * subindo a aplicacao inteira acaba nao sendo exercitada.
 */

/**
 * Padroes que denunciam dado pessoal escapando para o log. Nao substitui
 * revisao humana, mas quebra alto em desenvolvimento e teste quando alguem
 * interpola um CPF ou um e-mail de cliente na descricao.
 */
const PADROES_PROIBIDOS: ReadonlyArray<{ nome: string; regex: RegExp }> = [
  { nome: "CPF", regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/ },
  { nome: "CNPJ", regex: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/ },
  { nome: "e-mail", regex: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/ },
  { nome: "telefone", regex: /\b(?:\+55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/ },
];

export class DadoPessoalNoLogError extends Error {
  readonly padrao: string;

  constructor(padrao: string) {
    super(
      `Descricao de auditoria contem o que parece ser ${padrao}. ` +
        `Log de aplicacao nao pode conter dado pessoal de cliente: ` +
        `registre o identificador do registro, nao o seu conteudo.`,
    );
    this.name = "DadoPessoalNoLogError";
    this.padrao = padrao;
  }
}

/** Exportado para teste. Lanca quando a descricao aparenta conter dado pessoal. */
export function conferirDescricao(descricao: string): void {
  for (const { nome, regex } of PADROES_PROIBIDOS) {
    if (regex.test(descricao)) throw new DadoPessoalNoLogError(nome);
  }
}

/**
 * Compara duas versoes de um registro e devolve apenas os NOMES dos campos que
 * mudaram — nunca os valores, nem o antes nem o depois.
 */
export function camposAlterados(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): string[] {
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  const mudaram: string[] = [];
  for (const chave of chaves) {
    const a = antes[chave];
    const d = depois[chave];
    if (a instanceof Date || d instanceof Date) {
      if (String(a) !== String(d)) mudaram.push(chave);
    } else if (JSON.stringify(a) !== JSON.stringify(d)) {
      mudaram.push(chave);
    }
  }
  return mudaram.sort();
}
