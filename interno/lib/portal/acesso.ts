/**
 * Acesso do cliente ao portal.
 *
 * Não há cadastro nem senha para o cliente: o escritório emite um link
 * individual, com validade, e o entrega pelo canal oficial. O token trafega na
 * URL, mas o que fica no banco é o HASH — um dump do banco não dá acesso ao
 * portal de ninguém.
 *
 * A validade curta é deliberada: link de portal costuma ser encaminhado em
 * conversa de família, e um link eterno vira um acesso permanente de terceiro
 * ao processo do cliente.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const VALIDADE_PADRAO_DIAS = 30;

export function gerarTokenPortal(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTokenPortal(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparação em tempo constante, para não vazar o token por medida de tempo. */
export function tokensConferem(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function expiracao(dias: number = VALIDADE_PADRAO_DIAS, agora: Date = new Date()): Date {
  return new Date(agora.getTime() + dias * 86_400_000);
}

export interface SituacaoAcesso {
  valido: boolean;
  motivo?: "inexistente" | "revogado" | "expirado";
}

export function conferirAcesso(
  acesso: { revogadoEm: Date | null; expiraEm: Date } | null,
  agora: Date = new Date(),
): SituacaoAcesso {
  if (!acesso) return { valido: false, motivo: "inexistente" };
  if (acesso.revogadoEm) return { valido: false, motivo: "revogado" };
  if (acesso.expiraEm <= agora) return { valido: false, motivo: "expirado" };
  return { valido: true };
}
