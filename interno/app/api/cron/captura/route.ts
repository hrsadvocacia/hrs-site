import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { capturar } from "@/lib/publicacoes/captura";
import { FonteDjen } from "@/lib/publicacoes/djen";
import { registrar } from "@/lib/auditoria";

/**
 * Captura diária de publicações, por inscrição na OAB.
 *
 * Roda para TODAS as inscrições monitoradas, uma a uma, e nunca deixa a falha
 * de uma derrubar as outras: `capturar` já converte qualquer erro em registro
 * FALHA no batimento do dia.
 *
 * Enquanto o contrato do DJEN não estiver verificado, todas as capturas
 * registram FALHA — visível no painel, com a razão. É o comportamento correto:
 * o alternativo seria não registrar nada, e ausência de registro é
 * indistinguível de "não havia publicação".
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(requisicao: Request) {
  const segredo = process.env["CRON_SECRET"];
  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 500 });
  }
  if (requisicao.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const inscricoes = await prisma.inscricaoOab.findMany({
    where: { monitorada: true, ativa: true, usuario: { ativo: true } },
    select: { id: true, numero: true, uf: true },
  });

  const fonte = new FonteDjen();
  const resultados = [];
  for (const inscricao of inscricoes) {
    resultados.push(await capturar(fonte, inscricao, hoje));
  }

  const falhas = resultados.filter((r) => r.status === "FALHA").length;
  await registrar({
    usuarioId: null,
    usuarioEmail: "sistema@hrsadvocacia.com.br",
    acao: "ALTERACAO",
    entidade: "captura_diaria",
    descricao:
      `Captura diária de ${hoje}: ${inscricoes.length} inscrição(ões), ` +
      `${falhas} falha(s)`,
  });

  return NextResponse.json({
    data: hoje,
    inscricoes: inscricoes.length,
    novas: resultados.reduce((s, r) => s + r.novas, 0),
    duplicadas: resultados.reduce((s, r) => s + r.duplicadas, 0),
    falhas,
    detalhe: resultados,
  });
}
