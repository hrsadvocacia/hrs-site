/**
 * Limitação de tentativas com estado no Postgres.
 *
 * Decisão de projeto: o limitador FALHA ABERTO. Se o banco estiver indisponível,
 * a requisição segue em vez de ser recusada — um limitador que derruba o login
 * do escritório inteiro quando o Postgres oscila causa mais dano do que o
 * ataque que ele previne, e as outras defesas (senha com scrypt, TOTP
 * obrigatório, bloqueio por conta após 5 falhas) continuam de pé.
 *
 * Não substitui WAF nem proteção de borda. É a camada que existe sem depender
 * do plano contratado na Vercel.
 */
import { prisma } from "@/lib/prisma";
import { avaliar, chaveDe, type Decisao, type Politica } from "@/lib/limite/janela";

export { POLITICA_LOGIN, POLITICA_PORTAL } from "@/lib/limite/janela";

function segredo(): string {
  // AUTH_SECRET já é obrigatório para a sessão; reusá-lo evita mais uma
  // variável de ambiente para alguém esquecer de definir.
  return process.env["AUTH_SECRET"] ?? "";
}

/** IP da requisição atrás do proxy da Vercel. */
export function ipDaRequisicao(cabecalhos: Headers): string {
  return (
    cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    cabecalhos.get("x-real-ip") ??
    "desconhecido"
  );
}

export async function registrarTentativa(
  escopo: string,
  identificador: string,
  politica: Politica,
): Promise<Decisao> {
  const chave = chaveDe(escopo, identificador, segredo());
  const agora = new Date();

  try {
    const atual = await prisma.limiteTentativa.findUnique({ where: { chave } });
    const decisao = avaliar(atual ? { inicio: atual.inicio, contagem: atual.contagem } : null, politica, agora);

    await prisma.limiteTentativa.upsert({
      where: { chave },
      update: { inicio: decisao.estado.inicio, contagem: decisao.estado.contagem },
      create: { chave, inicio: decisao.estado.inicio, contagem: decisao.estado.contagem },
    });

    return decisao;
  } catch {
    // Falha aberto, e de propósito. Ver o comentário do topo.
    return { permitido: true, estado: { inicio: agora, contagem: 0 }, restantes: politica.maximo, esperaSegundos: 0 };
  }
}

/** Limpeza das janelas velhas — chamada pelo cron diário. */
export async function limparJanelasExpiradas(maxIdadeHoras = 24): Promise<number> {
  const corte = new Date(Date.now() - maxIdadeHoras * 3_600_000);
  const { count } = await prisma.limiteTentativa.deleteMany({ where: { inicio: { lt: corte } } });
  return count;
}
