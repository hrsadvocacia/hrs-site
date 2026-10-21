import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/auditoria";
import { gerarCsv } from "@/lib/exportacao/csv";
import { dataHoraBR } from "@/lib/tempo";
import { ACAO_AUDITORIA, rotulo } from "@/lib/rotulos";

/** Exportação do log — limitada a 5.000 linhas por vez, já filtradas na tela. */
export async function GET(requisicao: Request) {
  const usuario = await exigirPermissao("auditoria", "exportar");
  const p = new URL(requisicao.url).searchParams;

  const registros = await prisma.auditoria.findMany({
    where: {
      ...(p.get("acao") ? { acao: p.get("acao") as never } : {}),
      ...(p.get("usuario") ? { usuarioId: p.get("usuario")! } : {}),
      ...(p.get("entidade") ? { entidade: p.get("entidade")! } : {}),
    },
    orderBy: { ocorridoEm: "desc" },
    take: 5000,
    include: { usuario: { select: { nome: true } } },
  });

  const csv = gerarCsv(
    ["Quando", "Usuário", "E-mail", "Ação", "Entidade", "Id da entidade", "Descrição", "Campos alterados", "Sucesso", "IP"],
    registros.map((r) => [
      dataHoraBR(r.ocorridoEm),
      r.usuario?.nome ?? "",
      r.usuarioEmail,
      rotulo(ACAO_AUDITORIA, r.acao),
      r.entidade,
      r.entidadeId ?? "",
      r.descricao,
      r.camposAlterados.join(", "),
      r.sucesso ? "sim" : "não",
      r.ip ?? "",
    ]),
  );

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "EXPORTACAO",
    entidade: "auditoria",
    descricao: `Log de auditoria exportado (${registros.length} linhas)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="auditoria.csv"',
      "Cache-Control": "no-store",
    },
  });
}
