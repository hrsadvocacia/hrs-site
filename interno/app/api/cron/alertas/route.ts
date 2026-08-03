import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { alertasDoDia, type PrazoParaAlerta } from "@/lib/prazos/alertas";
import { registrar } from "@/lib/auditoria";

/**
 * Job diário de alertas de prazo.
 *
 * Idempotente: o alerta já enviado está gravado em `alerta_prazo` com chave
 * única (prazo, marco, canal, destinatário), então reexecutar no mesmo dia não
 * duplica aviso. Isso importa porque o cron da Vercel não garante execução
 * exatamente-uma-vez.
 *
 * O envio por e-mail entra junto com o provedor (Fase 3). Até lá o alerta é
 * gravado e aparece no painel — que é o canal que não depende de terceiro.
 */
export const dynamic = "force-dynamic";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(requisicao: Request) {
  // Vercel Cron envia o segredo no Authorization. Sem ele, qualquer um
  // dispararia o job.
  const segredo = process.env["CRON_SECRET"];
  if (!segredo) {
    return NextResponse.json(
      { erro: "CRON_SECRET não configurado no ambiente." },
      { status: 500 },
    );
  }
  if (requisicao.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const hoje = hojeISO();

  const prazos = await prisma.prazo.findMany({
    where: { status: { in: ["PENDENTE_CONFERENCIA", "CONFIRMADO", "EM_TRATATIVA"] } },
    select: {
      id: true,
      dataFatal: true,
      status: true,
      responsavelId: true,
      processo: { select: { unidade: true } },
      _count: { select: { tratativas: true } },
      alertas: { select: { marco: true } },
    },
  });

  // Um sócio por unidade, para o escalonamento de D-3.
  const socios = await prisma.usuario.findMany({
    where: { perfil: "SOCIO", ativo: true },
    orderBy: { criadoEm: "asc" },
    select: { id: true, unidade: true },
  });
  const socioPorUnidade = new Map<string, string>();
  for (const s of socios) {
    if (!socioPorUnidade.has(s.unidade)) socioPorUnidade.set(s.unidade, s.id);
  }

  const paraRegra: PrazoParaAlerta[] = prazos.map((p) => ({
    id: p.id,
    dataFatal: p.dataFatal.toISOString().slice(0, 10),
    status: p.status,
    responsavelId: p.responsavelId,
    socioResponsavelId: socioPorUnidade.get(p.processo.unidade) ?? null,
    temTratativa: p._count.tratativas > 0,
    marcosJaEnviados: p.alertas.map((a) => a.marco),
  }));

  const aDisparar = alertasDoDia(paraRegra, hoje);

  let gravados = 0;
  for (const a of aDisparar) {
    try {
      await prisma.alertaPrazo.create({
        data: {
          prazoId: a.prazoId,
          marco: a.marco,
          canal: "PAINEL",
          destinatarioId: a.destinatarioId,
          escalonamento: a.escalonamento,
          enviadoEm: new Date(),
        },
      });
      gravados++;
    } catch {
      // Violação da chave única = alerta já existia. É o comportamento
      // esperado numa reexecução, não um erro.
    }
  }

  await registrar({
    usuarioId: null,
    usuarioEmail: "sistema@hrsadvocacia.com.br",
    acao: "ALTERACAO",
    entidade: "alerta_prazo",
    descricao: `Rotina diária de alertas: ${gravados} alerta(s) gerado(s) sobre ${prazos.length} prazo(s) em curso`,
  });

  return NextResponse.json({
    data: hoje,
    prazosAvaliados: prazos.length,
    alertasGerados: gravados,
    escalonamentos: aDisparar.filter((a) => a.escalonamento).length,
  });
}
