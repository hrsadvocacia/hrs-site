/**
 * Dinheiro em CENTAVOS inteiros.
 *
 * Honorário é somado, parcelado e conferido contra extrato. Ponto flutuante
 * produz 0,1 + 0,2 = 0,30000000000000004 — e relatório financeiro com centavo
 * quebrado é relatório em que ninguém confia. O banco guarda DECIMAL(14,2); a
 * aplicação converte para inteiro na entrada e só volta a decimal na saída.
 */

/** "1.234,56", "1234.56", "1234,5" ou "1234" -> 123456. Lança se inválido. */
export function paraCentavos(texto: string | number): number {
  if (typeof texto === "number") {
    if (!Number.isFinite(texto)) throw new Error("Valor inválido.");
    return Math.round(texto * 100);
  }
  const limpo = texto.trim().replace(/R\$\s*/i, "");
  if (limpo === "") throw new Error("Valor inválido.");

  // Decide o separador decimal pela ÚLTIMA pontuação: "1.234,56" é vírgula,
  // "1,234.56" é ponto, "1234.5" é ponto, "1234,5" é vírgula.
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let inteiro: string;
  let fracao = "";
  if (ultimaVirgula > ultimoPonto) {
    inteiro = limpo.slice(0, ultimaVirgula).replace(/[.\s]/g, "");
    fracao = limpo.slice(ultimaVirgula + 1);
  } else if (ultimoPonto > ultimaVirgula) {
    const depois = limpo.slice(ultimoPonto + 1);
    // "1.234" sem vírgula: milhar, não decimal.
    if (depois.length === 3 && !limpo.includes(",")) {
      inteiro = limpo.replace(/[.\s]/g, "");
    } else {
      inteiro = limpo.slice(0, ultimoPonto).replace(/[,\s]/g, "");
      fracao = depois;
    }
  } else {
    inteiro = limpo;
  }

  if (!/^-?\d+$/.test(inteiro) || !/^\d{0,2}$/.test(fracao)) {
    throw new Error("Valor inválido.");
  }
  const negativo = inteiro.startsWith("-");
  const centavos =
    Math.abs(Number(inteiro)) * 100 + Number((fracao + "00").slice(0, 2));
  return negativo ? -centavos : centavos;
}

/** 123456 -> "1.234,56" (sem símbolo, para tabela e CSV). */
export function formatarCentavos(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const inteiro = Math.floor(abs / 100).toString();
  const fracao = (abs % 100).toString().padStart(2, "0");
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}${comMilhar},${fracao}`;
}

/** 123456 -> "R$ 1.234,56". */
export function formatarBRL(centavos: number): string {
  return `R$ ${formatarCentavos(centavos)}`;
}

/** 123456 -> "1234.56" — formato que o Prisma aceita para DECIMAL. */
export function paraDecimal(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  return `${negativo ? "-" : ""}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}

/** Decimal vindo do banco ("1234.56" ou objeto com toString) -> 123456. */
export function deDecimal(valor: { toString(): string } | string | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  return paraCentavos(String(valor));
}
