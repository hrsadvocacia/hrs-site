import { prisma } from "@/lib/prisma";
import type { UsuarioAutenticado } from "@/lib/sessao";
import { consolidar } from "@/lib/honorarios/regras";
import { deDecimal } from "@/lib/honorarios/dinheiro";
import { dataUTC } from "@/lib/tempo";
import { filtroContratos } from "../consulta";

export interface FiltroRelatorio {
  de: string;
  ate: string;
  unidade?: string;
  advogadoId?: string;
}

/**
 * Lançamentos do período (pela data de reconhecimento) com os filtros de
 * unidade e advogado (responsável pelo processo vinculado). Devolve também o
 * consolidado por natureza e, separadamente, por unidade e por advogado.
 */
export async function consultarRelatorio(usuario: UsuarioAutenticado, f: FiltroRelatorio) {
  const filtroContrato = filtroContratos(usuario);
  const lancamentos = await prisma.lancamentoHonorarios.findMany({
    where: {
      dataReconhecimento: { gte: dataUTC(f.de), lte: dataUTC(f.ate) },
      ...(f.unidade ? { unidade: f.unidade as never } : {}),
      ...(f.advogadoId ? { processo: { advogadoResponsavelId: f.advogadoId } } : {}),
      ...(usuario.perfil === "ADVOGADO"
        ? { OR: [{ contrato: filtroContrato }, { processo: { advogadoResponsavelId: usuario.id } }] }
        : {}),
    },
    orderBy: { dataReconhecimento: "asc" },
    include: {
      processo: { select: { numeroCnj: true, advogadoResponsavel: { select: { nome: true } } } },
      contrato: { select: { id: true, cliente: { select: { nome: true } } } },
    },
  });

  const paraConsolidar = (ls: typeof lancamentos) =>
    consolidar(ls.map((l) => ({ natureza: l.natureza, valorCentavos: deDecimal(l.valor), provisao: l.provisao, recebido: l.recebido })));

  const porUnidade = new Map<string, ReturnType<typeof consolidar>>();
  for (const u of ["GOIANIA", "TERESINA", "TIMON"]) {
    const ls = lancamentos.filter((l) => l.unidade === u);
    if (ls.length) porUnidade.set(u, paraConsolidar(ls));
  }
  const porAdvogado = new Map<string, ReturnType<typeof consolidar>>();
  for (const l of lancamentos) {
    const nome = l.processo?.advogadoResponsavel.nome ?? "Sem processo vinculado";
    if (!porAdvogado.has(nome)) porAdvogado.set(nome, paraConsolidar(lancamentos.filter((x) => (x.processo?.advogadoResponsavel.nome ?? "Sem processo vinculado") === nome)));
  }

  return { lancamentos, geral: paraConsolidar(lancamentos), porUnidade, porAdvogado };
}

export function lerFiltro(params: Record<string, string | undefined>, hoje: string): FiltroRelatorio {
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  return {
    de: /^\d{4}-\d{2}-\d{2}$/.test(params["de"] ?? "") ? params["de"]! : inicioMes,
    ate: /^\d{4}-\d{2}-\d{2}$/.test(params["ate"] ?? "") ? params["ate"]! : hoje,
    unidade: params["unidade"] || undefined,
    advogadoId: params["advogadoId"] || undefined,
  };
}
