"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
}

/**
 * Confirmação diária de conferência do Domicílio Judicial Eletrônico.
 *
 * Não há integração — citação e intimação com exigência de pessoalidade correm
 * por lá e não aparecem no DJEN. Isto é registro de ato humano: alguém abriu o
 * Domicílio hoje, olhou, e assina que olhou.
 *
 * O valor do registro não está em provar que foi conferido; está em tornar
 * VISÍVEL o dia em que não foi.
 */
export async function confirmarConferencia(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("publicacao", "confirmar");
  const data = String(dados.get("data") ?? "");
  const unidade = String(dados.get("unidade") ?? "");
  const houveNovidade = dados.get("houveNovidade") === "on";
  const observacao = String(dados.get("observacao") ?? "").trim();

  if (!data || !unidade) return { erro: "Dia e unidade são obrigatórios." };
  if (houveNovidade && observacao.length < 5) {
    return {
      erro:
        "Havendo comunicação nova no Domicílio, descreva o que foi encontrado " +
        "e o encaminhamento dado.",
    };
  }

  const dia = new Date(`${data}T00:00:00Z`);
  await prisma.checklistDomicilio.upsert({
    where: { data_unidade: { data: dia, unidade: unidade as never } },
    update: {
      confirmadoPorId: usuario.id,
      confirmadoEm: new Date(),
      houveNovidade,
      observacao: observacao || null,
    },
    create: {
      data: dia,
      unidade: unidade as never,
      responsavelId: usuario.id,
      confirmadoPorId: usuario.id,
      confirmadoEm: new Date(),
      houveNovidade,
      observacao: observacao || null,
    },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "checklist_domicilio",
    descricao:
      `Conferência do Domicílio Judicial confirmada para ${data} na unidade ` +
      `${unidade}${houveNovidade ? " — com comunicação nova" : ""}`,
  });

  revalidatePath("/domicilio");
  revalidatePath("/");
  return { ok: "Conferência registrada." };
}
