/**
 * Triagem de publicações — regra pura.
 *
 * Decide o destino de cada comunicação capturada. Três princípios:
 *
 *   1. NADA É DESCARTADO. Publicação que não casa com processo conhecido vira
 *      órfã e vai para a fila humana. O sistema nunca conclui sozinho que uma
 *      comunicação não interessa.
 *
 *   2. HOMÔNIMO É RISCO REAL. Se o nome do advogado bate mas a OAB não, a
 *      publicação pode ser de outro profissional — ou pode ser nossa, com a
 *      OAB grafada de outro jeito na origem. Nos dois casos, decide gente.
 *
 *   3. NÚMERO DE PROCESSO SÓ VALE COM DÍGITO VERIFICADOR CONFERIDO. Casar por
 *      número malformado poderia vincular a comunicação ao processo errado, e
 *      um prazo no processo errado é pior que um prazo órfão.
 */
import { analisarCnj, somenteDigitos } from "../documentos.ts";

export type DestinoTriagem =
  | "VINCULADA"
  | "ORFA"
  | "SUSPEITA_HOMONIMO"
  | "PENDENTE_TRIAGEM";

export interface InscricaoConhecida {
  numero: string;
  uf: string;
  nomeAdvogado: string;
}

export interface ProcessoConhecido {
  id: string;
  numeroCnjDigitos: string;
}

export interface EntradaTriagem {
  numeroProcesso?: string | null | undefined;
  teor: string;
  nomeAdvogadoCitado?: string | null | undefined;
  numeroOabCitado?: string | null | undefined;
  ufOabCitada?: string | null | undefined;
}

export interface ResultadoTriagem {
  destino: DestinoTriagem;
  /** Preenchido só quando o CNJ casou com processo cadastrado. */
  processoId: string | null;
  /** Somente dígitos, quando houver CNJ válido. */
  numeroProcessoDigitos: string | null;
  suspeitaHomonimo: boolean;
  /** Explicação em português, exibida na fila de triagem. */
  motivo: string;
}

/** Normalização para comparar nome de pessoa: sem acento, sem caixa, sem ruído. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Padrão do número único CNJ, com ou sem máscara, dentro de um texto corrido. */
const PADRAO_CNJ = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/g;

/**
 * Extrai o CNJ da publicação: primeiro do campo próprio, depois do teor.
 *
 * Só devolve número cujo dígito verificador confere. Um número com DV errado é
 * ruído (ou erro de OCR na origem) e não pode servir de chave de vinculação.
 */
export function extrairCnj(entrada: EntradaTriagem): string | null {
  const doCampo = entrada.numeroProcesso
    ? somenteDigitos(entrada.numeroProcesso)
    : "";
  if (doCampo.length === 20 && analisarCnj(doCampo)) return doCampo;

  for (const achado of entrada.teor.match(PADRAO_CNJ) ?? []) {
    const digitos = somenteDigitos(achado);
    if (digitos.length === 20 && analisarCnj(digitos)) return digitos;
  }
  return null;
}

/**
 * A OAB citada na publicação corresponde a alguma inscrição do escritório?
 * Comparação por dígitos: a origem grafa "76.478", "76478" e "076478".
 */
export function oabConfere(
  entrada: EntradaTriagem,
  inscricoes: readonly InscricaoConhecida[],
): boolean {
  if (!entrada.numeroOabCitado) return false;
  const numero = somenteDigitos(entrada.numeroOabCitado).replace(/^0+/, "");
  const uf = (entrada.ufOabCitada ?? "").trim().toUpperCase();
  return inscricoes.some(
    (i) =>
      somenteDigitos(i.numero).replace(/^0+/, "") === numero &&
      (uf === "" || i.uf.toUpperCase() === uf),
  );
}

/** O nome citado é de alguém do escritório? */
export function nomeConfere(
  entrada: EntradaTriagem,
  inscricoes: readonly InscricaoConhecida[],
): boolean {
  if (!entrada.nomeAdvogadoCitado) return false;
  const citado = normalizarNome(entrada.nomeAdvogadoCitado);
  if (!citado) return false;
  return inscricoes.some((i) => normalizarNome(i.nomeAdvogado) === citado);
}

export function triar(
  entrada: EntradaTriagem,
  processos: readonly ProcessoConhecido[],
  inscricoes: readonly InscricaoConhecida[],
): ResultadoTriagem {
  const cnj = extrairCnj(entrada);
  const processo = cnj
    ? (processos.find((p) => p.numeroCnjDigitos === cnj) ?? null)
    : null;

  // Homônimo: o nome é nosso, a OAB não. Pode ser outro profissional de mesmo
  // nome, ou a nossa com grafia diferente na origem. Decide gente — e a
  // suspeita prevalece sobre a vinculação automática, porque vincular a
  // publicação de outro advogado ao nosso processo criaria prazo falso.
  const suspeita = nomeConfere(entrada, inscricoes) && !oabConfere(entrada, inscricoes);

  if (suspeita) {
    return {
      destino: "SUSPEITA_HOMONIMO",
      processoId: processo?.id ?? null,
      numeroProcessoDigitos: cnj,
      suspeitaHomonimo: true,
      motivo:
        "O nome do advogado confere com alguém do escritório, mas a OAB citada " +
        "não corresponde a nenhuma inscrição cadastrada. Pode ser homônimo.",
    };
  }

  if (processo) {
    return {
      destino: "VINCULADA",
      processoId: processo.id,
      numeroProcessoDigitos: cnj,
      suspeitaHomonimo: false,
      motivo: "Número único CNJ conferido e casado com processo cadastrado.",
    };
  }

  if (cnj) {
    return {
      destino: "ORFA",
      processoId: null,
      numeroProcessoDigitos: cnj,
      suspeitaHomonimo: false,
      motivo:
        "Número único CNJ válido, mas não há processo com esse número no " +
        "cadastro. Pode ser processo ainda não cadastrado.",
    };
  }

  return {
    destino: "ORFA",
    processoId: null,
    numeroProcessoDigitos: null,
    suspeitaHomonimo: false,
    motivo:
      "Não foi possível identificar um número único CNJ válido na comunicação.",
  };
}
