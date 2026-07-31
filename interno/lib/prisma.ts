import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Cliente Prisma unico por processo.
 *
 * Em desenvolvimento o hot reload recria modulos a cada alteracao; sem o cache
 * em `globalThis` cada recarga abriria um novo pool e o Postgres esgotaria as
 * conexoes. Em producao o modulo e avaliado uma vez por instancia.
 *
 * `log` NUNCA inclui `query`: os parametros de uma query carregam CPF, nome e
 * conteudo de processo, e log de aplicacao nao e lugar para dado de cliente.
 */
const globalParaPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function criarCliente(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL ausente no ambiente.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ["warn", "error"],
  });
}

export const prisma = globalParaPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
