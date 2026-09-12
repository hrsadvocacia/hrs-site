"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { pode } from "@/lib/rbac";
import { nomeSeguro, validarArquivo } from "@/lib/arquivos/validacao";
import { armazenamentoNoBanco, chaveDeArmazenamento } from "@/lib/arquivos/armazenamento";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
}

/**
 * Upload de documento.
 *
 * O tipo é decidido pelos BYTES, não pela extensão nem pelo Content-Type que o
 * navegador declarou — os dois são escolhidos por quem envia. O conteúdo é
 * cifrado antes de tocar o banco. O status de antivírus fica PENDENTE e a tela
 * diz isso: não há verificador contratado, e marcar "limpo" sem verificar
 * seria mentir para quem abre o arquivo.
 *
 * Versionamento: enviar com o mesmo nome no mesmo processo cria uma nova
 * versão apontando para a anterior. Nada é sobrescrito.
 */
export async function enviarDocumento(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("documento", "criar");
  const arquivo = dados.get("arquivo");
  const clienteId = String(dados.get("clienteId") ?? "") || null;
  const processoId = String(dados.get("processoId") ?? "") || null;
  const sensivel = dados.get("sensivel") === "on";
  const privilegiado = dados.get("privilegiado") === "on";

  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione o arquivo." };
  if (!clienteId && !processoId) return { erro: "Vincule o documento a um cliente ou a um processo." };
  if (sensivel && !pode(usuario.perfil, "documentoSensivel", "criar")) {
    return { erro: "Seu perfil não pode enviar documento sensível." };
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const nome = nomeSeguro(arquivo.name);
  const validacao = validarArquivo(bytes, nome);
  if (!validacao.ok || !validacao.tipo) return { erro: validacao.erro ?? "Arquivo recusado." };

  const hash = createHash("sha256").update(bytes).digest("hex");

  // Mesma pasta (processo ou cliente) e mesmo nome: nova versão.
  const anterior = await prisma.documento.findFirst({
    where: { nome, ...(processoId ? { processoId } : { clienteId }) },
    orderBy: { versao: "desc" },
    select: { id: true, versao: true, hashSha256: true },
  });
  if (anterior?.hashSha256 === hash) {
    return { erro: "Este arquivo já está anexado (conteúdo idêntico ao existente)." };
  }

  const documento = await prisma.documento.create({
    data: {
      clienteId,
      processoId,
      nome,
      tipoMime: validacao.tipo.mime,
      tamanho: bytes.length,
      chaveStorage: `pendente-${hash}-${Date.now()}`,
      hashSha256: hash,
      versao: (anterior?.versao ?? 0) + 1,
      documentoPaiId: anterior?.id ?? null,
      sensivel,
      privilegiado,
      antivirusStatus: "PENDENTE",
      enviadoPorId: usuario.id,
    },
    select: { id: true },
  });

  const chave = chaveDeArmazenamento(documento.id);
  const { blob, versaoChave } = armazenamentoNoBanco.guardar(chave, bytes);
  await prisma.$transaction([
    prisma.documentoConteudo.create({
      data: { documentoId: documento.id, conteudoCifrado: new Uint8Array(blob), versaoChave },
    }),
    prisma.documento.update({ where: { id: documento.id }, data: { chaveStorage: chave } }),
  ]);

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "documento",
    entidadeId: documento.id,
    descricao: `Documento anexado (${validacao.tipo.rotulo}, versão ${(anterior?.versao ?? 0) + 1}${sensivel ? ", sensível" : ""})`,
  });

  if (processoId) revalidatePath(`/processos/${processoId}`);
  if (clienteId) revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/documentos");
  return { ok: "Documento anexado." };
}
