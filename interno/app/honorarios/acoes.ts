"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { gerarParcelas, validarModalidade, type Modalidade } from "@/lib/honorarios/regras";
import { paraCentavos, paraDecimal } from "@/lib/honorarios/dinheiro";
import { dataUTC } from "@/lib/tempo";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

function centavosOuNulo(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  return paraCentavos(t);
}

function errosDeCampo(analise: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const p of analise.issues) {
    const chave = String(p.path[0] ?? "");
    if (chave && !campos[chave]) campos[chave] = p.message;
  }
  return campos;
}

const esquemaContrato = z.object({
  clienteId: z.string().uuid("Selecione o cliente."),
  modalidade: z.enum(["FIXO", "EXITO", "MISTO", "PRO_LABORE_MAIS_EXITO", "CONSULTIVO_MENSAL"]),
  valorFixo: z.string().optional().or(z.literal("")),
  percentualExito: z.string().optional().or(z.literal("")),
  valorProLabore: z.string().optional().or(z.literal("")),
  valorMensal: z.string().optional().or(z.literal("")),
  objeto: z.string().trim().min(5, "Descreva o objeto do contrato."),
  dataAssinatura: z.string().min(10, "Informe a data de assinatura."),
  vigenciaInicio: z.string().min(10, "Informe o início da vigência."),
  vigenciaFim: z.string().optional().or(z.literal("")),
  unidade: z.enum(["GOIANIA", "TERESINA", "TIMON"]),
  quantidadeParcelas: z.string().optional().or(z.literal("")),
  primeiroVencimento: z.string().optional().or(z.literal("")),
});

const CAMPOS_CONTRATO = [
  "clienteId", "modalidade", "valorFixo", "percentualExito", "valorProLabore", "valorMensal",
  "objeto", "dataAssinatura", "vigenciaInicio", "vigenciaFim", "unidade",
  "quantidadeParcelas", "primeiroVencimento",
] as const;

/**
 * Contrato de honorários. Os campos de valor obedecem à modalidade
 * (validação em lib/honorarios/regras). O parcelamento é gerado na hora, com
 * a soma batendo ao centavo, para a parte FIXA do contrato: valor fixo,
 * pró-labore ou mensalidade. Êxito não se parcela — vira lançamento quando
 * (e se) houver.
 */
export async function criarContrato(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("financeiro", "criar");
  const valores: Record<string, string> = Object.fromEntries(
    CAMPOS_CONTRATO.map((c) => [c, String(dados.get(c) ?? "").trim()]),
  );
  const processoIds = dados.getAll("processoIds").map(String).filter(Boolean);
  valores["processoIds"] = processoIds.join(",");

  const analise = esquemaContrato.safeParse(valores);
  if (!analise.success) {
    return { erro: "Confira os campos destacados.", campos: errosDeCampo(analise.error), valores };
  }
  const d = analise.data;

  let campos;
  try {
    campos = {
      valorFixo: centavosOuNulo(d.valorFixo ?? ""),
      percentualExito: d.percentualExito ? Number(d.percentualExito.replace(",", ".")) : null,
      valorProLabore: centavosOuNulo(d.valorProLabore ?? ""),
      valorMensal: centavosOuNulo(d.valorMensal ?? ""),
    };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Valor inválido.", valores };
  }

  const errosModalidade = validarModalidade(d.modalidade as Modalidade, campos);
  if (errosModalidade.length > 0) {
    return { erro: errosModalidade.join(" "), valores };
  }

  const totalParcelavel = campos.valorFixo ?? campos.valorProLabore ?? null;
  const quantidade = d.quantidadeParcelas ? Number(d.quantidadeParcelas) : 0;
  let parcelas: ReturnType<typeof gerarParcelas> = [];
  try {
    if (d.modalidade === "CONSULTIVO_MENSAL" && campos.valorMensal && quantidade > 0) {
      if (!d.primeiroVencimento) return { erro: "Informe o primeiro vencimento das mensalidades.", valores };
      parcelas = gerarParcelas({
        totalCentavos: campos.valorMensal * quantidade,
        quantidade,
        primeiroVencimento: d.primeiroVencimento,
      });
    } else if (totalParcelavel && quantidade > 0) {
      if (!d.primeiroVencimento) return { erro: "Informe o vencimento da primeira parcela.", valores };
      parcelas = gerarParcelas({ totalCentavos: totalParcelavel, quantidade, primeiroVencimento: d.primeiroVencimento });
    }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Parcelamento inválido.", valores };
  }

  const contrato = await prisma.contratoHonorarios.create({
    data: {
      clienteId: d.clienteId,
      modalidade: d.modalidade,
      valorFixo: campos.valorFixo !== null ? paraDecimal(campos.valorFixo) : null,
      percentualExito: campos.percentualExito !== null ? campos.percentualExito.toFixed(2) : null,
      valorProLabore: campos.valorProLabore !== null ? paraDecimal(campos.valorProLabore) : null,
      valorMensal: campos.valorMensal !== null ? paraDecimal(campos.valorMensal) : null,
      objeto: d.objeto,
      dataAssinatura: dataUTC(d.dataAssinatura),
      vigenciaInicio: dataUTC(d.vigenciaInicio),
      vigenciaFim: d.vigenciaFim ? dataUTC(d.vigenciaFim) : null,
      unidade: d.unidade,
      processos: { create: processoIds.map((processoId) => ({ processoId })) },
      parcelas: {
        create: parcelas.map((p) => ({
          numero: p.numero,
          valor: paraDecimal(p.valorCentavos),
          vencimento: dataUTC(p.vencimento),
        })),
      },
    },
    select: { id: true },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "contrato_honorarios",
    entidadeId: contrato.id,
    descricao: `Contrato de honorários cadastrado (${d.modalidade}, ${parcelas.length} parcela(s))`,
  });

  revalidatePath("/honorarios");
  redirect(`/honorarios/${contrato.id}`);
}

/**
 * Baixa de parcela. Cria, na mesma transação, o lançamento CONTRATUAL
 * recebido — parcela paga é honorário contratual realizado, e o relatório
 * precisa refletir isso sem depender de segundo lançamento manual.
 */
export async function registrarPagamento(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("financeiro", "editar");
  const parcelaId = String(dados.get("parcelaId") ?? "");
  const pagoEm = String(dados.get("pagoEm") ?? "");
  const valorPagoTexto = String(dados.get("valorPago") ?? "").trim();
  const forma = String(dados.get("formaPagamento") ?? "");
  const observacao = String(dados.get("observacao") ?? "").trim();

  if (!parcelaId || !pagoEm || !valorPagoTexto || !forma) {
    return { erro: "Data, valor e forma de pagamento são obrigatórios." };
  }
  let valorPago: number;
  try {
    valorPago = paraCentavos(valorPagoTexto);
  } catch {
    return { erro: "Valor pago inválido." };
  }
  if (valorPago <= 0) return { erro: "Valor pago deve ser positivo." };

  const parcela = await prisma.parcela.findUniqueOrThrow({
    where: { id: parcelaId },
    include: { contrato: { select: { id: true, unidade: true, processos: { select: { processoId: true }, take: 1 } } } },
  });
  if (parcela.status === "PAGO") return { erro: "Esta parcela já está baixada." };
  if (parcela.status === "CANCELADO") return { erro: "Parcela cancelada não recebe pagamento." };

  await prisma.$transaction([
    prisma.parcela.update({
      where: { id: parcelaId },
      data: {
        status: "PAGO",
        pagoEm: dataUTC(pagoEm),
        valorPago: paraDecimal(valorPago),
        formaPagamento: forma as never,
        observacao: observacao || null,
      },
    }),
    prisma.lancamentoHonorarios.create({
      data: {
        natureza: "CONTRATUAL",
        contratoId: parcela.contrato.id,
        processoId: parcela.contrato.processos[0]?.processoId ?? null,
        valor: paraDecimal(valorPago),
        dataReconhecimento: dataUTC(pagoEm),
        provisao: false,
        recebido: true,
        recebidoEm: dataUTC(pagoEm),
        unidade: parcela.contrato.unidade,
        descricao: `Parcela ${parcela.numero}`,
      },
    }),
  ]);

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "parcela",
    entidadeId: parcelaId,
    descricao: `Parcela ${parcela.numero} baixada como paga`,
    camposAlterados: ["status", "pagoEm", "valorPago", "formaPagamento"],
  });

  revalidatePath(`/honorarios/${parcela.contrato.id}`);
  revalidatePath("/honorarios");
  return { ok: "Pagamento registrado." };
}

/** Renegociação ou cancelamento de parcela — sempre com observação. */
export async function alterarStatusParcela(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("financeiro", "editar");
  const parcelaId = String(dados.get("parcelaId") ?? "");
  const status = String(dados.get("status") ?? "");
  const observacao = String(dados.get("observacao") ?? "").trim();
  if (!["RENEGOCIADO", "CANCELADO", "A_VENCER"].includes(status)) return { erro: "Situação inválida." };
  if (observacao.length < 10) return { erro: "Explique o motivo (ao menos 10 caracteres)." };

  const parcela = await prisma.parcela.findUniqueOrThrow({ where: { id: parcelaId }, select: { status: true, contratoId: true, numero: true } });
  if (parcela.status === "PAGO") return { erro: "Parcela paga não muda de situação." };

  await prisma.parcela.update({ where: { id: parcelaId }, data: { status: status as never, observacao } });
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "parcela",
    entidadeId: parcelaId,
    descricao: `Parcela ${parcela.numero} marcada como ${status}`,
    camposAlterados: ["status", "observacao"],
  });
  revalidatePath(`/honorarios/${parcela.contratoId}`);
  return { ok: "Situação da parcela atualizada." };
}

const esquemaLancamento = z.object({
  contratoId: z.string().uuid().optional().or(z.literal("")),
  processoId: z.string().uuid().optional().or(z.literal("")),
  natureza: z.enum(["CONTRATUAL", "SUCUMBENCIA", "CONTRATUAL_DESTACADO"]),
  valor: z.string().min(1, "Informe o valor."),
  dataReconhecimento: z.string().min(10, "Informe a data."),
  provisao: z.string().optional(),
  recebido: z.string().optional(),
  recebidoEm: z.string().optional().or(z.literal("")),
  unidade: z.enum(["GOIANIA", "TERESINA", "TIMON"]),
  descricao: z.string().trim().optional().or(z.literal("")),
});

/**
 * Lançamento avulso: sucumbência, destacado, ou êxito. Provisão de êxito é
 * marcada como tal e NUNCA como recebida — o banco recusa a combinação.
 */
export async function lancarHonorario(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("financeiro", "criar");
  const valores: Record<string, string> = {};
  for (const c of ["contratoId", "processoId", "natureza", "valor", "dataReconhecimento", "provisao", "recebido", "recebidoEm", "unidade", "descricao"]) {
    valores[c] = String(dados.get(c) ?? "").trim();
  }
  const analise = esquemaLancamento.safeParse(valores);
  if (!analise.success) return { erro: "Confira os campos.", campos: errosDeCampo(analise.error), valores };
  const d = analise.data;

  let valor: number;
  try {
    valor = paraCentavos(d.valor);
  } catch {
    return { erro: "Valor inválido.", valores };
  }
  if (valor <= 0) return { erro: "Valor deve ser positivo.", valores };

  const provisao = d.provisao === "on";
  const recebido = !provisao && d.recebido === "on";
  if (recebido && !d.recebidoEm) return { erro: "Informe a data do recebimento.", valores };
  if (provisao && d.recebido === "on") {
    return { erro: "Provisão de êxito é expectativa: não pode ser marcada como recebida.", valores };
  }

  const lancamento = await prisma.lancamentoHonorarios.create({
    data: {
      natureza: d.natureza,
      contratoId: d.contratoId || null,
      processoId: d.processoId || null,
      valor: paraDecimal(valor),
      dataReconhecimento: dataUTC(d.dataReconhecimento),
      provisao,
      recebido,
      recebidoEm: recebido && d.recebidoEm ? dataUTC(d.recebidoEm) : null,
      unidade: d.unidade,
      descricao: d.descricao || null,
    },
    select: { id: true },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "lancamento_honorarios",
    entidadeId: lancamento.id,
    descricao: `Lançamento de honorários ${d.natureza}${provisao ? " (provisão)" : recebido ? " recebido" : " a receber"}`,
  });

  if (d.contratoId) revalidatePath(`/honorarios/${d.contratoId}`);
  revalidatePath("/honorarios/relatorio");
  return { ok: "Lançamento registrado." };
}

export async function marcarRecebido(lancamentoId: string, recebidoEm: string): Promise<void> {
  const usuario = await exigirPermissao("financeiro", "editar");
  if (!recebidoEm) throw new Error("Informe a data do recebimento.");
  const l = await prisma.lancamentoHonorarios.findUniqueOrThrow({ where: { id: lancamentoId }, select: { provisao: true, contratoId: true } });
  if (l.provisao) throw new Error("Provisão não se recebe: lance o valor efetivo como novo lançamento.");
  await prisma.lancamentoHonorarios.update({
    where: { id: lancamentoId },
    data: { recebido: true, recebidoEm: dataUTC(recebidoEm) },
  });
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "lancamento_honorarios",
    entidadeId: lancamentoId,
    descricao: "Lançamento marcado como recebido",
    camposAlterados: ["recebido", "recebidoEm"],
  });
  if (l.contratoId) revalidatePath(`/honorarios/${l.contratoId}`);
  revalidatePath("/honorarios/relatorio");
}

export async function encerrarContrato(contratoId: string): Promise<void> {
  const usuario = await exigirPermissao("financeiro", "inativar");
  await prisma.contratoHonorarios.update({ where: { id: contratoId }, data: { ativo: false } });
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "INATIVACAO",
    entidade: "contrato_honorarios",
    entidadeId: contratoId,
    descricao: "Contrato de honorários encerrado",
  });
  revalidatePath(`/honorarios/${contratoId}`);
  revalidatePath("/honorarios");
}
