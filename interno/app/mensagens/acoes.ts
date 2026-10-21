"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { validarTexto, type Violacao } from "@/lib/mensagens/compliance";
import { CATEGORIAS, renderizar, variaveisIndevidas, VariavelAusenteError, VARIAVEIS_POR_CATEGORIA, type Categoria } from "@/lib/mensagens/variaveis";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
  violacoes?: Violacao[];
  valores?: Record<string, string>;
}

/**
 * Criação de template. A validação anti-promessa roda AQUI, antes de gravar:
 * template com violação não é salvo nem como rascunho — não existe estado
 * "salvo mas inválido" para alguém usar por engano. O carimbo `validadoEm`
 * é a prova de que passou, e o banco recusa envio sem ele.
 */
export async function criarTemplate(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("templateMensagem", "criar");
  const valores = {
    codigo: String(dados.get("codigo") ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "-"),
    titulo: String(dados.get("titulo") ?? "").trim(),
    canal: String(dados.get("canal") ?? ""),
    categoria: String(dados.get("categoria") ?? ""),
    corpo: String(dados.get("corpo") ?? "").trim(),
    nomeTemplateWhatsapp: String(dados.get("nomeTemplateWhatsapp") ?? "").trim(),
  };

  if (valores.codigo.length < 3) return { erro: "Informe um código (ex.: AUDIENCIA-TRT).", valores };
  if (valores.titulo.length < 3) return { erro: "Informe o título.", valores };
  if (!["EMAIL", "WHATSAPP"].includes(valores.canal)) return { erro: "Canal inválido.", valores };
  if (!CATEGORIAS.includes(valores.categoria as Categoria)) return { erro: "Categoria inválida.", valores };
  if (valores.corpo.length < 10) return { erro: "Escreva o corpo da mensagem.", valores };

  const violacoes = [
    ...validarTexto(valores.corpo),
    ...variaveisIndevidas(valores.corpo, valores.categoria as Categoria),
  ];
  if (violacoes.length > 0) {
    return {
      erro: "O texto contém conteúdo vedado ao contato com o cliente e não foi salvo. Corrija os trechos abaixo.",
      violacoes,
      valores,
    };
  }

  const existente = await prisma.templateMensagem.findUnique({ where: { codigo: valores.codigo }, select: { id: true } });
  if (existente) return { erro: "Já existe template com este código.", valores };

  const template = await prisma.templateMensagem.create({
    data: {
      codigo: valores.codigo,
      titulo: valores.titulo,
      canal: valores.canal as "EMAIL" | "WHATSAPP",
      categoria: valores.categoria as Categoria,
      corpo: valores.corpo,
      nomeTemplateWhatsapp: valores.nomeTemplateWhatsapp || null,
      validadoEm: new Date(),
      criadoPorId: usuario.id,
    },
    select: { id: true },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "template_mensagem",
    entidadeId: template.id,
    descricao: `Template ${valores.codigo} criado e validado (${valores.categoria}, ${valores.canal})`,
  });

  revalidatePath("/mensagens");
  redirect("/mensagens");
}

export async function inativarTemplate(templateId: string): Promise<void> {
  const usuario = await exigirPermissao("templateMensagem", "inativar");
  await prisma.templateMensagem.update({ where: { id: templateId }, data: { ativo: false } });
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "INATIVACAO",
    entidade: "template_mensagem",
    entidadeId: templateId,
    descricao: "Template de mensagem inativado",
  });
  revalidatePath("/mensagens");
}

/**
 * Registro de envio (assistido). Renderiza o template com as variáveis,
 * recusa se faltar alguma, valida o texto FINAL de novo (uma variável como
 * {{orientacoes}} poderia carregar promessa), e grava o envio como PENDENTE
 * com autor identificado. Um cliente por vez — não há envio em lote.
 */
export async function registrarEnvio(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("atendimento", "criar");
  const clienteId = String(dados.get("clienteId") ?? "");
  const templateId = String(dados.get("templateId") ?? "");
  const canal = String(dados.get("canal") ?? "");
  const destinatario = String(dados.get("destinatario") ?? "").trim();
  const valores: Record<string, string> = {};
  for (const [k, v] of dados.entries()) {
    if (k.startsWith("var_")) valores[k.slice(4)] = String(v).trim();
  }

  if (!clienteId || !templateId || !destinatario || !["EMAIL", "WHATSAPP"].includes(canal)) {
    return { erro: "Cliente, template, canal e destinatário são obrigatórios.", valores };
  }

  const template = await prisma.templateMensagem.findUnique({ where: { id: templateId } });
  if (!template || !template.ativo || !template.validadoEm) {
    return { erro: "Template indisponível: inativo ou sem validação.", valores };
  }
  if (template.canal !== canal) return { erro: "O template escolhido é de outro canal.", valores };

  let corpo: string;
  try {
    corpo = renderizar(template.corpo, valores);
  } catch (e) {
    if (e instanceof VariavelAusenteError) return { erro: e.message, valores };
    throw e;
  }
  const violacoes = validarTexto(corpo);
  if (violacoes.length > 0) {
    return {
      erro: "O texto final, com as variáveis preenchidas, contém conteúdo vedado. Reveja o que foi digitado.",
      violacoes,
      valores,
    };
  }

  const envio = await prisma.envioMensagem.create({
    data: {
      templateId,
      clienteId,
      canal: canal as "EMAIL" | "WHATSAPP",
      destinatario,
      variaveis: { valores, corpo },
      status: "PENDENTE",
      enviadoPorId: usuario.id,
    },
    select: { id: true },
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ENVIO_MENSAGEM",
    entidade: "envio_mensagem",
    entidadeId: envio.id,
    descricao: `Mensagem preparada a partir do template ${template.codigo} (${canal})`,
  });

  redirect(`/mensagens/envios/${envio.id}`);
}

export async function marcarEnvio(envioId: string, resultado: "ENVIADO" | "FALHA", erro?: string): Promise<void> {
  const usuario = await exigirPermissao("atendimento", "criar");
  const envio = await prisma.envioMensagem.findUniqueOrThrow({ where: { id: envioId }, select: { status: true, clienteId: true } });
  if (envio.status !== "PENDENTE") throw new Error("Este envio já foi concluído.");
  await prisma.envioMensagem.update({
    where: { id: envioId },
    data: {
      status: resultado,
      enviadoEm: resultado === "ENVIADO" ? new Date() : null,
      erro: resultado === "FALHA" ? (erro?.trim() || "Falha informada pelo usuário") : null,
    },
  });
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ENVIO_MENSAGEM",
    entidade: "envio_mensagem",
    entidadeId: envioId,
    descricao: resultado === "ENVIADO" ? "Mensagem enviada pelo canal oficial (confirmação do usuário)" : "Envio de mensagem marcado como falho",
  });
  revalidatePath(`/mensagens/envios/${envioId}`);
  revalidatePath(`/clientes/${envio.clienteId}`);
}

export async function variaveisDaCategoria(categoria: string): Promise<readonly string[]> {
  return VARIAVEIS_POR_CATEGORIA[categoria as Categoria] ?? [];
}
