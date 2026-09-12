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

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ateMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]!);
  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto]!);
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]!);
  }
  return partes.join(" e ");
}

/** Valor por extenso para recibo: 123456 -> "mil duzentos e trinta e quatro reais e cinquenta e seis centavos". */
export function porExtenso(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos < 0 || centavos >= 1_000_000_000_00) {
    throw new Error("Valor fora da faixa suportada para extenso.");
  }
  const reais = Math.floor(centavos / 100);
  const cents = centavos % 100;

  const grupos = [
    { valor: Math.floor(reais / 1_000_000), singular: "milhão", plural: "milhões" },
    { valor: Math.floor((reais % 1_000_000) / 1000), singular: "mil", plural: "mil" },
    { valor: reais % 1000, singular: "", plural: "" },
  ];
  const partes: string[] = [];
  for (const g of grupos) {
    if (g.valor === 0) continue;
    if (g.singular === "mil") {
      partes.push(g.valor === 1 ? "mil" : `${ateMil(g.valor)} mil`);
    } else if (g.singular) {
      partes.push(`${ateMil(g.valor)} ${g.valor === 1 ? g.singular : g.plural}`);
    } else {
      partes.push(ateMil(g.valor));
    }
  }
  let texto = "";
  if (reais > 0) {
    // "e" antes do último grupo quando ele é < 100 ou múltiplo exato de 100.
    const ultimo = reais % 1000;
    const usaE = partes.length > 1 && (ultimo < 100 || ultimo % 100 === 0);
    texto = usaE ? `${partes.slice(0, -1).join(" ")} e ${partes[partes.length - 1]}` : partes.join(" ");
    if (reais >= 1_000_000 && reais % 1_000_000 === 0) texto += " de";
    texto += reais === 1 ? " real" : " reais";
  }
  if (cents > 0) {
    const c = `${ateMil(cents)} ${cents === 1 ? "centavo" : "centavos"}`;
    texto = texto ? `${texto} e ${c}` : c;
  }
  return texto || "zero reais";
}
