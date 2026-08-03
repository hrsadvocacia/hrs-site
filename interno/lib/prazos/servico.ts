import { prisma } from "@/lib/prisma";
import {
  identificarCalendario,
  montarCalendario,
} from "@/lib/prazos/composicao";
import { calcularPrazo, type RegimeContagem, type ResultadoCalculo } from "@/lib/prazos/motor";
import { ano as anoDe, type DataISO } from "@/lib/prazos/dias";

/**
 * Casca de acesso a dados em volta do motor. A regra de composição e a de
 * contagem continuam puras; aqui só se busca o que elas precisam.
 */

export class CalendarioIndisponivelError extends Error {
  readonly tribunal: string;
  readonly ano: number;

  constructor(tribunal: string, ano: number) {
    super(
      `Não há calendário VIGENTE do ${tribunal} para ${ano}. ` +
        `Enquanto as suspensões de expediente por portaria não forem lançadas ` +
        `e o calendário não for aprovado, o cálculo não é confiável.`,
    );
    this.name = "CalendarioIndisponivelError";
    this.tribunal = tribunal;
    this.ano = ano;
  }
}

export interface CalculoDoProcesso extends ResultadoCalculo {
  calendarioId: string | null;
}

/**
 * Calcula um prazo para um processo específico.
 *
 * RECUSA calcular quando o calendário do tribunal não está VIGENTE. Um
 * calendário em RASCUNHO é um calendário sem as portarias conferidas: produzir
 * uma data a partir dele seria entregar um número com aparência de fundamento.
 * Melhor falhar alto e mandar preencher.
 */
export async function calcularParaProcesso(params: {
  processoId: string;
  prazoDias: number;
  regime?: RegimeContagem;
  dataDisponibilizacao?: string;
  dataPublicacao?: string;
}): Promise<CalculoDoProcesso> {
  const processo = await prisma.processo.findUniqueOrThrow({
    where: { id: params.processoId },
    select: {
      regimeContagem: true,
      tribunal: { select: { id: true, codigo: true, sigla: true, regimeContagemPadrao: true } },
      orgaoJulgador: { select: { id: true, municipio: true, uf: true } },
    },
  });

  const referencia = (params.dataDisponibilizacao ?? params.dataPublicacao)!;
  const ano = anoDe(referencia as DataISO);

  const calendario = await prisma.calendarioTribunal.findFirst({
    where: { tribunalId: processo.tribunal.id, ano, status: "VIGENTE" },
    orderBy: { versao: "desc" },
    select: { id: true, versao: true, dias: true },
  });

  if (!calendario) {
    throw new CalendarioIndisponivelError(processo.tribunal.sigla, ano);
  }

  // O ano seguinte importa: prazo iniciado em dezembro vence depois do recesso.
  const calendarioSeguinte = await prisma.calendarioTribunal.findFirst({
    where: { tribunalId: processo.tribunal.id, ano: ano + 1, status: "VIGENTE" },
    orderBy: { versao: "desc" },
    select: { dias: true },
  });

  const feriados = await prisma.feriadoGeral.findMany({
    where: {
      data: {
        gte: new Date(Date.UTC(ano, 0, 1)),
        lte: new Date(Date.UTC(ano + 1, 11, 31)),
      },
    },
    select: {
      data: true,
      nome: true,
      abrangencia: true,
      uf: true,
      municipio: true,
      suspendeExpediente: true,
      fonte: true,
    },
  });

  const dias = [...calendario.dias, ...(calendarioSeguinte?.dias ?? [])].map((d) => ({
    data: d.data,
    descricao: d.descricao,
    suspendeExpediente: d.suspendeExpediente,
    fonte: d.fonte,
    orgaoJulgadorId: d.orgaoJulgadorId,
  }));

  const local = {
    municipio: processo.orgaoJulgador?.municipio ?? null,
    uf: processo.orgaoJulgador?.uf ?? null,
    orgaoJulgadorId: processo.orgaoJulgador?.id ?? null,
  };

  const identificacao = identificarCalendario(
    processo.tribunal.codigo,
    ano,
    calendario.versao,
    local.municipio,
  );

  const resultado = calcularPrazo({
    dataDisponibilizacao: params.dataDisponibilizacao,
    dataPublicacao: params.dataPublicacao,
    prazoDias: params.prazoDias,
    regime:
      params.regime ??
      processo.regimeContagem ??
      (processo.tribunal.regimeContagemPadrao as RegimeContagem),
    calendario: montarCalendario(identificacao, local, feriados, dias),
  });

  return { ...resultado, calendarioId: calendario.id };
}

/** Sócio da unidade, para quem o prazo escala a partir de D-3. */
export async function socioDaUnidade(unidade: string): Promise<string | null> {
  const socio = await prisma.usuario.findFirst({
    where: { perfil: "SOCIO", ativo: true, unidade: unidade as never },
    orderBy: { criadoEm: "asc" },
    select: { id: true },
  });
  return socio?.id ?? null;
}
