/**
 * TOTP (RFC 6238) sobre HOTP (RFC 4226), com base32 (RFC 4648).
 *
 * Implementado sobre `node:crypto` em vez de uma dependencia porque o
 * algoritmo tem vetores de teste OFICIAIS: e possivel provar que esta correto
 * (ver lib/totp.test.ts) em vez de confiar no changelog de um pacote. Sao ~80
 * linhas no caminho critico do 2FA de um sistema sob sigilo profissional.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALFABETO_B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function paraBase32(dados: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = "";
  for (const byte of dados) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO_B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO_B32[(valor << (5 - bits)) & 31];
  return saida;
}

export function deBase32(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const caractere of limpo) {
    const indice = ALFABETO_B32.indexOf(caractere);
    if (indice === -1) throw new Error("Segredo base32 inválido.");
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Segredo de 20 bytes (160 bits), como recomenda a RFC 4226. */
export function gerarSegredoTotp(): string {
  return paraBase32(randomBytes(20));
}

export type AlgoritmoTotp = "sha1" | "sha256" | "sha512";

/** HOTP: codigo para um contador especifico. */
export function gerarHotp(
  segredo: Buffer,
  contador: bigint,
  digitos = 6,
  algoritmo: AlgoritmoTotp = "sha1",
): string {
  const bufferContador = Buffer.alloc(8);
  bufferContador.writeBigUInt64BE(contador);

  const hmac = createHmac(algoritmo, segredo).update(bufferContador).digest();
  // Truncagem dinamica (RFC 4226, secao 5.3).
  const deslocamento = hmac[hmac.length - 1]! & 0x0f;
  const binario =
    ((hmac[deslocamento]! & 0x7f) << 24) |
    ((hmac[deslocamento + 1]! & 0xff) << 16) |
    ((hmac[deslocamento + 2]! & 0xff) << 8) |
    (hmac[deslocamento + 3]! & 0xff);

  return (binario % 10 ** digitos).toString().padStart(digitos, "0");
}

export function contadorTotp(emSegundos: number, passo = 30): bigint {
  return BigInt(Math.floor(emSegundos / passo));
}

export function gerarTotp(
  segredoBase32: string,
  emSegundos: number = Date.now() / 1000,
  opcoes: { passo?: number; digitos?: number; algoritmo?: AlgoritmoTotp } = {},
): string {
  const { passo = 30, digitos = 6, algoritmo = "sha1" } = opcoes;
  return gerarHotp(
    deBase32(segredoBase32),
    contadorTotp(emSegundos, passo),
    digitos,
    algoritmo,
  );
}

export interface ResultadoConferencia {
  valido: boolean;
  /** Contador que casou. Deve ser gravado para impedir reuso do mesmo passo. */
  contador?: bigint;
}

/**
 * Confere o codigo aceitando uma janela de tolerancia para relogio dessincronizado.
 *
 * `contadorMinimo` implementa anti-replay: um codigo ja usado nao vale de novo,
 * mesmo dentro da janela. Sem isso, quem enxergasse o codigo por cima do ombro
 * teria ate 90 segundos para reutiliza-lo.
 */
export function conferirTotp(
  codigoInformado: string,
  segredoBase32: string,
  opcoes: {
    emSegundos?: number;
    janela?: number;
    passo?: number;
    digitos?: number;
    algoritmo?: AlgoritmoTotp;
    contadorMinimo?: bigint | null;
  } = {},
): ResultadoConferencia {
  const {
    emSegundos = Date.now() / 1000,
    janela = 1,
    passo = 30,
    digitos = 6,
    algoritmo = "sha1",
    contadorMinimo = null,
  } = opcoes;

  const informado = codigoInformado.replace(/\D/g, "");
  if (informado.length !== digitos) return { valido: false };

  const segredo = deBase32(segredoBase32);
  const atual = contadorTotp(emSegundos, passo);

  for (let desvio = -janela; desvio <= janela; desvio++) {
    const contador = atual + BigInt(desvio);
    if (contador < 0n) continue;
    if (contadorMinimo !== null && contador <= contadorMinimo) continue;

    const esperado = gerarHotp(segredo, contador, digitos, algoritmo);
    const a = Buffer.from(esperado, "utf8");
    const b = Buffer.from(informado, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { valido: true, contador };
    }
  }
  return { valido: false };
}

/** URI `otpauth://` para leitura por aplicativo autenticador. */
export function uriTotp(
  segredoBase32: string,
  email: string,
  emissor = "HRS Advocacia",
): string {
  const rotulo = encodeURIComponent(`${emissor}:${email}`);
  const parametros = new URLSearchParams({
    secret: segredoBase32,
    issuer: emissor,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${rotulo}?${parametros.toString()}`;
}

/**
 * Codigos de backup para perda do dispositivo. Sao mostrados UMA vez e
 * guardados apenas como hash — o sistema nao consegue reexibi-los depois.
 */
export function gerarCodigosBackup(quantidade = 8): string[] {
  return Array.from({ length: quantidade }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
  );
}
