/**
 * Criptografia em repouso e hash de senha.
 *
 * Sem dependencia externa: tudo aqui sai de `node:crypto`. Uma biblioteca a
 * mais nesta camada e uma superficie a mais de supply chain justamente no
 * ponto que protege dado de saude e segredo de 2FA.
 *
 * Decisao (D-0.5): AES-256-GCM aplicado NA APLICACAO, nao com `pgcrypto`.
 * Com pgcrypto a chave viaja no texto do comando SQL e acaba em log de slow
 * query ou de erro do Postgres — o mecanismo de protecao vazaria a chave.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const TAMANHO_IV = 12; // GCM padrao
const TAMANHO_TAG = 16;

/** Chave mestra da versao pedida, lida do ambiente. Nunca fica em codigo. */
function chaveMestra(versao: number): Buffer {
  const bruta = process.env[`CHAVE_CRIPTOGRAFIA_V${versao}`];
  if (!bruta) {
    throw new Error(
      `Chave de criptografia versao ${versao} ausente no ambiente. ` +
        `Defina CHAVE_CRIPTOGRAFIA_V${versao}.`,
    );
  }
  const chave = Buffer.from(bruta, "base64");
  if (chave.length !== 32) {
    throw new Error(
      `CHAVE_CRIPTOGRAFIA_V${versao} deve ter 32 bytes em base64 (AES-256).`,
    );
  }
  return chave;
}

export function versaoChaveAtual(): number {
  const v = Number(process.env["CHAVE_CRIPTOGRAFIA_VERSAO_ATUAL"] ?? "1");
  if (!Number.isInteger(v) || v < 1) {
    throw new Error("CHAVE_CRIPTOGRAFIA_VERSAO_ATUAL invalida.");
  }
  return v;
}

/**
 * Cifra texto para gravacao em coluna `Bytes`.
 * Layout do blob: iv(12) || tag(16) || ciphertext.
 *
 * `contextoAutenticado` entra como AAD: amarra o blob ao registro a que
 * pertence, de modo que um blob copiado de outra linha nao decifra. Use algo
 * estavel, como `dado_sensivel:<uuid>`.
 */
export function cifrar(
  textoClaro: string,
  contextoAutenticado: string,
  versao = versaoChaveAtual(),
): { blob: Buffer; versaoChave: number } {
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv("aes-256-gcm", chaveMestra(versao), iv);
  cipher.setAAD(Buffer.from(contextoAutenticado, "utf8"));
  const cifrado = Buffer.concat([
    cipher.update(textoClaro, "utf8"),
    cipher.final(),
  ]);
  return {
    blob: Buffer.concat([iv, cipher.getAuthTag(), cifrado]),
    versaoChave: versao,
  };
}

/**
 * Decifra o blob. Lanca se a tag nao conferir — o que acontece tanto em
 * adulteracao quanto em contexto errado. Falha fechada, nunca devolve lixo.
 */
export function decifrar(
  blob: Buffer,
  contextoAutenticado: string,
  versao: number,
): string {
  if (blob.length <= TAMANHO_IV + TAMANHO_TAG) {
    throw new Error("Blob cifrado malformado.");
  }
  const iv = blob.subarray(0, TAMANHO_IV);
  const tag = blob.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG);
  const cifrado = blob.subarray(TAMANHO_IV + TAMANHO_TAG);

  const decipher = createDecipheriv("aes-256-gcm", chaveMestra(versao), iv);
  decipher.setAAD(Buffer.from(contextoAutenticado, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString(
    "utf8",
  );
}

// ---------------------------------------------------------------------------
// Senhas — scrypt (RFC 7914), memoria-dura, nativo do Node.
//
// Preferido a bcrypt por resistir melhor a ataque com hardware dedicado, e
// preferido a uma dependencia de argon2 por nao exigir binario nativo no
// runtime da Vercel. Parametros: N=2^15, r=8, p=1 (~32 MB por verificacao).
// ---------------------------------------------------------------------------
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_TAMANHO = 64;

export function gerarHashSenha(senha: string): string {
  const sal = randomBytes(16);
  const derivada = scryptSync(senha.normalize("NFKC"), sal, SCRYPT_TAMANHO, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * SCRYPT_N * SCRYPT_R * 2,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    sal.toString("base64"),
    derivada.toString("base64"),
  ].join("$");
}

/** Comparacao em tempo constante. Retorna false em qualquer hash malformado. */
export function conferirSenha(senha: string, hashArmazenado: string): boolean {
  const partes = hashArmazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const n = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  const sal = Buffer.from(partes[4]!, "base64");
  const esperada = Buffer.from(partes[5]!, "base64");
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  try {
    const derivada = scryptSync(senha.normalize("NFKC"), sal, esperada.length, {
      N: n,
      r,
      p,
      maxmem: 128 * n * r * 2,
    });
    return timingSafeEqual(derivada, esperada);
  } catch {
    return false;
  }
}

/** Hash simples para token de sessao e codigo de backup (alta entropia). */
export function hashToken(token: string): string {
  // Entrada e aleatoria e longa: nao precisa de KDF lenta, precisa de digest.
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function gerarTokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
