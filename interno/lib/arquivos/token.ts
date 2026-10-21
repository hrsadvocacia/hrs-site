/**
 * URL assinada de curta duração para download de documento.
 *
 * O arquivo nunca é servido por caminho adivinhável. O link carrega um token
 * HMAC que amarra documento + usuário + validade; a rota de download confere o
 * token E refaz a checagem de permissão no momento do clique — o token prova
 * que o link foi gerado para aquela pessoa, não que ela ainda pode ver o
 * arquivo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const VALIDADE_PADRAO_SEGUNDOS = 5 * 60;

export interface CargaToken {
  documentoId: string;
  usuarioId: string;
  expiraEm: number; // epoch em segundos
}

function assinar(carga: string, segredo: string): string {
  return createHmac("sha256", segredo).update(carga).digest("base64url");
}

export function gerarToken(
  carga: Omit<CargaToken, "expiraEm">,
  segredo: string,
  agora: Date = new Date(),
  validadeSegundos: number = VALIDADE_PADRAO_SEGUNDOS,
): string {
  const expiraEm = Math.floor(agora.getTime() / 1000) + validadeSegundos;
  const texto = `${carga.documentoId}.${carga.usuarioId}.${expiraEm}`;
  const codificado = Buffer.from(texto, "utf8").toString("base64url");
  return `${codificado}.${assinar(texto, segredo)}`;
}

export function verificarToken(
  token: string,
  segredo: string,
  agora: Date = new Date(),
): CargaToken | null {
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  let texto: string;
  try {
    texto = Buffer.from(partes[0]!, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const esperada = assinar(texto, segredo);
  const a = Buffer.from(partes[1]!);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [documentoId, usuarioId, exp] = texto.split(".");
  if (!documentoId || !usuarioId || !exp) return null;
  const expiraEm = Number(exp);
  if (!Number.isInteger(expiraEm) || expiraEm < Math.floor(agora.getTime() / 1000)) return null;
  return { documentoId, usuarioId, expiraEm };
}
