import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/auditoria";
import { gerarIcal } from "@/lib/agenda/ical";
import { TIPO_COMPROMISSO, rotulo } from "@/lib/rotulos";

/**
 * Exportação .ics da agenda.
 *
 * O arquivo vai para o calendário do celular, que sincroniza com nuvem de
 * terceiro não contratada como operadora. Por isso o evento leva apenas o tipo,
 * o local e o horário — sem nome de cliente, sem número de processo, sem
 * observação. Quem precisa do detalhe abre o sistema.
 */
export async function GET(requisicao: Request) {
  const usuario = await exigirPermissao("agenda", "ler");
  const url = new URL(requisicao.url);
  const responsavel = url.searchParams.get("responsavel");

  const compromissos = await prisma.compromisso.findMany({
    where: {
      status: "AGENDADO",
      dataHora: { gte: new Date(Date.now() - 30 * 86_400_000) },
      ...(responsavel ? { responsavelId: responsavel } : {}),
    },
    orderBy: { dataHora: "asc" },
    select: { id: true, tipo: true, dataHora: true, duracaoMinutos: true, municipio: true, uf: true, forum: true, virtual: true },
  });

  const ical = gerarIcal(
    compromissos.map((c) => ({
      uid: c.id,
      titulo: rotulo(TIPO_COMPROMISSO, c.tipo),
      inicio: c.dataHora,
      duracaoMinutos: c.duracaoMinutos ?? 60,
      local: c.virtual ? "Virtual" : [c.forum, `${c.municipio}/${c.uf}`].filter(Boolean).join(" — "),
      descricao: "Detalhes no sistema interno do escritório.",
    })),
  );

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "EXPORTACAO",
    entidade: "compromisso",
    descricao: `Agenda exportada em iCal (${compromissos.length} compromissos, sem dado de cliente)`,
  });

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="agenda-hrs.ics"',
      "Cache-Control": "no-store",
    },
  });
}
