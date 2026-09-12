import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { alertasDoDia, type PrazoParaAlerta } from "@/lib/prazos/alertas";
import { registrar } from "@/lib/auditoria";
import { revisoesPendentes } from "@/lib/prazos/revisao";
import { limparJanelasExpiradas } from "@/lib/limite/servico";

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

  // --- Revisão anual dos calendários -----------------------------------------
  // Calendário do ano anterior não é "quase certo": é errado em dias
  // específicos, e cada um vira prazo contado a mais ou a menos. A cobrança
  // começa em novembro e o carimbo evita repetir o alerta todo dia.
  const revisoes = await prisma.revisaoAnualCalendario.findMany({
    where: { status: { not: "CONCLUIDA" } },
    include: {
      tribunal: {
        select: { id: true, sigla: true, calendarios: { where: { status: "VIGENTE" }, select: { ano: true } } },
      },
    },
  });

  const pendentesRevisao = revisoesPendentes(
    revisoes.map((r) => ({
      tribunalId: r.tribunalId,
      tribunalSigla: r.tribunal.sigla,
      ano: r.ano,
      status: r.status as "PENDENTE" | "EM_ANDAMENTO",
      temCalendarioVigente: r.tribunal.calendarios.some((c) => c.ano === r.ano),
    })),
    hoje,
  );

  let revisoesCarimbadas = 0;
  for (const p of pendentesRevisao) {
    const registro = revisoes.find((r) => r.tribunalId === p.tribunalId && r.ano === p.ano);
    if (!registro) continue;
    // Um carimbo por semana: o alerta precisa insistir sem virar ruído diário.
    const ultimoAlerta = registro.alertaDisparadoEm?.getTime() ?? 0;
    if (Date.now() - ultimoAlerta < 7 * 86_400_000) continue;
    await prisma.revisaoAnualCalendario.update({
      where: { id: registro.id },
      data: { alertaDisparadoEm: new Date() },
    });
    revisoesCarimbadas++;
  }

  const janelasLimpas = await limparJanelasExpiradas();

  await registrar({
    usuarioId: null,
    usuarioEmail: "sistema@hrsadvocacia.com.br",
    acao: "ALTERACAO",
    entidade: "alerta_prazo",
    descricao:
      `Rotina diária: ${gravados} alerta(s) de prazo sobre ${prazos.length} prazo(s) em curso; ` +
      `${pendentesRevisao.length} revisão(ões) de calendário pendente(s); ` +
      `${janelasLimpas} janela(s) de limitação expurgada(s)`,
  });

  return NextResponse.json({
    data: hoje,
    prazosAvaliados: prazos.length,
    alertasGerados: gravados,
    escalonamentos: aDisparar.filter((a) => a.escalonamento).length,
    revisoesPendentes: pendentesRevisao.map((p) => ({ tribunal: p.tribunalSigla, ano: p.ano, urgencia: p.urgencia })),
    revisoesCarimbadas,
    janelasDeLimitacaoExpurgadas: janelasLimpas,
  });
}
