/**
 * Validacao e parsing de documentos brasileiros e do numero CNJ.
 *
 * Funcoes puras, sem I/O — cobertas por lib/documentos.test.ts.
 */

// ---------------------------------------------------------------------------
// CPF / CNPJ
// ---------------------------------------------------------------------------

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Valida CPF pelo digito verificador (modulo 11).
 * Recusa as sequencias repetidas (000...0, 111...1), que passam na aritmetica
 * mas nao sao CPF valido.
 */
export function validarCpf(entrada: string): boolean {
  const cpf = somenteDigitos(entrada);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  for (const [posicao, pesoInicial] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < posicao; i++) {
      soma += Number(cpf[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    const digito = resto === 10 ? 0 : resto;
    if (digito !== Number(cpf[posicao])) return false;
  }
  return true;
}

/** Valida CNPJ pelo digito verificador (modulo 11, pesos 2..9 ciclicos). */
export function validarCnpj(entrada: string): boolean {
  const cnpj = somenteDigitos(entrada);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcular = (tamanho: number): number => {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(cnpj[i]) * peso;
      peso = peso - 1 < 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calcular(12) === Number(cnpj[12]) && calcular(13) === Number(cnpj[13]);
}

export function validarCpfCnpj(entrada: string): boolean {
  const digitos = somenteDigitos(entrada);
  if (digitos.length === 11) return validarCpf(digitos);
  if (digitos.length === 14) return validarCnpj(digitos);
  return false;
}

export function formatarCpfCnpj(entrada: string): string {
  const d = somenteDigitos(entrada);
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return entrada;
}

// ---------------------------------------------------------------------------
// Numero unico CNJ — Resolucao CNJ 65/2008
//
// Formato NNNNNNN-DD.AAAA.J.TR.OOOO
//   NNNNNNN  sequencial por unidade de origem, reiniciado a cada ano
//   DD       digito verificador (modulo 97 base 10, ISO 7064)
//   AAAA     ano do ajuizamento
//   J        segmento do Judiciario
//   TR       tribunal
//   OOOO     unidade de origem
// ---------------------------------------------------------------------------

export interface CamposCnj {
  sequencial: string;
  digito: string;
  ano: number;
  segmento: string;
  tribunal: string;
  origem: string;
  /** Somente digitos, 20 caracteres — usado para casar com o DJEN. */
  digitos: string;
  /** Formatado para exibicao. */
  formatado: string;
}

const SEGMENTOS: Record<string, string> = {
  "1": "Supremo Tribunal Federal",
  "2": "Conselho Nacional de Justica",
  "3": "Superior Tribunal de Justica",
  "4": "Justica Federal",
  "5": "Justica do Trabalho",
  "6": "Justica Eleitoral",
  "7": "Justica Militar da Uniao",
  "8": "Justica dos Estados e do DF",
  "9": "Justica Militar Estadual",
};

export function descreverSegmentoCnj(segmento: string): string | undefined {
  return SEGMENTOS[segmento];
}

/**
 * Calcula o digito verificador pelo modulo 97 base 10 (ISO 7064), como manda
 * a Res. CNJ 65/2008: DD = 98 - ((NNNNNNN AAAA J TR OOOO 00) mod 97).
 *
 * O numero excede o inteiro seguro do JavaScript, entao a reducao e feita
 * digito a digito — mesma tecnica do calculo de IBAN.
 */
export function calcularDigitoCnj(
  sequencial: string,
  ano: string,
  segmento: string,
  tribunal: string,
  origem: string,
): string {
  const base = `${sequencial}${ano}${segmento}${tribunal}${origem}00`;
  let resto = 0;
  for (const caractere of base) {
    resto = (resto * 10 + Number(caractere)) % 97;
  }
  return String(98 - resto).padStart(2, "0");
}

/**
 * Faz o parse e valida o digito verificador. Retorna null quando o numero e
 * malformado ou o DV nao confere — o chamador decide o que fazer, e nenhuma
 * tela deve aceitar processo com CNJ invalido em silencio.
 */
export function analisarCnj(entrada: string): CamposCnj | null {
  const d = somenteDigitos(entrada);
  if (d.length !== 20) return null;

  const sequencial = d.slice(0, 7);
  const digito = d.slice(7, 9);
  const ano = d.slice(9, 13);
  const segmento = d.slice(13, 14);
  const tribunal = d.slice(14, 16);
  const origem = d.slice(16, 20);

  const anoNumero = Number(ano);
  if (anoNumero < 1900 || anoNumero > 2200) return null;
  if (!SEGMENTOS[segmento]) return null;

  if (calcularDigitoCnj(sequencial, ano, segmento, tribunal, origem) !== digito) {
    return null;
  }

  return {
    sequencial,
    digito,
    ano: anoNumero,
    segmento,
    tribunal,
    origem,
    digitos: d,
    formatado: `${sequencial}-${digito}.${ano}.${segmento}.${tribunal}.${origem}`,
  };
}

export function cnjValido(entrada: string): boolean {
  return analisarCnj(entrada) !== null;
}
