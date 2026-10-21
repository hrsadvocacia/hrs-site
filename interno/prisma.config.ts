import "dotenv/config";
import { defineConfig } from "prisma/config";

// A URL do banco NUNCA vai para o repositorio: vem de variavel de ambiente
// (Vercel Project Settings -> Environment Variables, escopo do projeto interno).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
