"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar, camposAlterados } from "@/lib/auditoria";
import { somenteDigitos, validarCpfCnpj } from "@/lib/documentos";

/**
 * Base legal do tratamento (LGPD): art. 7, V — execucao de contrato de
 * prestacao de servico advocaticio, e art. 7, II para os campos exigidos por
 * obrigacao legal (CPF/CNPJ em procuracao e peticao). Dado de saude NAO entra
 * aqui: vai para `dado_sensivel_cliente`, cifrado e com leitura registrada.
 */
const esquemaCliente = z.object({
  tipoPessoa: z.enum(["FISICA", "JURIDICA"]),
  nome: z.string().trim().min(3, "Informe o nome completo ou a razao social."),
  nomeSocial: z.string().trim().optional().or(z.literal("")),
  nomeFantasia: z.string().trim().optional().or(z.literal("")),
  cpfCnpj: z.string().refine(validarCpfCnpj, "CPF ou CNPJ invalido."),
  dataNascimento: z.string().optional().or(z.literal("")),
  estadoCivil: z.string().trim().optional().or(z.literal("")),
  profissao: z.string().trim().optional().or(z.literal("")),
  origem: z.enum([
    "INDICACAO",
    "SIMULADOR_SITE",
    "REDES_SOCIAIS",
    "BALCAO",
    "OUTRO",
  ]),
  origemDetalhe: z.string().trim().optional().or(z.literal("")),
  unidadeResponsavel: z.enum(["GOIANIA", "TERESINA", "TIMON"]),
  observacoes: z.string().trim().optional().or(z.literal("")),
  // Endereco principal
  cep: z.string().trim().optional().or(z.literal("")),
  logradouro: z.string().trim().optional().or(z.literal("")),
  numero: z.string().trim().optional().or(z.literal("")),
  bairro: z.string().trim().optional().or(z.literal("")),
  municipio: z.string().trim().optional().or(z.literal("")),
  uf: z.string().trim().length(2).optional().or(z.literal("")),
  // Contatos
  telefone: z.string().trim().optional().or(z.literal("")),
  whatsapp: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("E-mail invalido.").optional().or(z.literal("")),
});

export interface EstadoFormulario {
  erro?: string;
  campos?: Record<string, string>;
  /**
   * O que o usuario havia digitado. Devolvido junto do erro para que o
   * formulario nao apague uma ficha inteira por causa de um digito errado.
   */
  valores?: Record<string, string>;
}

const CAMPOS_CLIENTE = [
  "tipoPessoa", "nome", "nomeSocial", "nomeFantasia", "cpfCnpj",
  "dataNascimento", "estadoCivil", "profissao", "origem", "origemDetalhe",
  "unidadeResponsavel", "observacoes", "cep", "logradouro", "numero",
  "bairro", "municipio", "uf", "telefone", "whatsapp", "email",
] as const;

function opcional(valor: FormDataEntryValue | null): string {
  return String(valor ?? "").trim();
}

export async function criarCliente(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("cliente", "criar");

  const bruto = Object.fromEntries(
    CAMPOS_CLIENTE.map((campo) => [campo, opcional(dados.get(campo))]),
  );
  const analise = esquemaCliente.safeParse(bruto);

  if (!analise.success) {
    const campos: Record<string, string> = {};
    for (const problema of analise.error.issues) {
      const chave = String(problema.path[0] ?? "");
      if (chave && !campos[chave]) campos[chave] = problema.message;
    }
    return { erro: "Confira os campos destacados.", campos, valores: bruto };
  }

  const d = analise.data;
  const documento = somenteDigitos(d.cpfCnpj);

  const jaExiste = await prisma.cliente.findUnique({
    where: { cpfCnpj: documento },
    select: { id: true },
  });
  if (jaExiste) {
    return {
      erro: "Ja existe cliente cadastrado com este CPF/CNPJ.",
      campos: { cpfCnpj: "Documento ja cadastrado." },
      valores: bruto,
    };
  }

  const cliente = await prisma.cliente.create({
    data: {
      tipoPessoa: d.tipoPessoa,
      nome: d.nome,
      nomeSocial: d.nomeSocial || null,
      nomeFantasia: d.nomeFantasia || null,
      cpfCnpj: documento,
      dataNascimento: d.dataNascimento ? new Date(d.dataNascimento) : null,
      estadoCivil: d.estadoCivil || null,
      profissao: d.profissao || null,
      origem: d.origem,
      origemDetalhe: d.origemDetalhe || null,
      unidadeResponsavel: d.unidadeResponsavel,
      observacoes: d.observacoes || null,
      enderecos:
        d.logradouro && d.municipio && d.uf
          ? {
              create: [
                {
                  cep: d.cep || null,
                  logradouro: d.logradouro,
                  numero: d.numero || null,
                  bairro: d.bairro || null,
                  municipio: d.municipio,
                  uf: d.uf.toUpperCase(),
                  principal: true,
                },
              ],
            }
          : undefined,
      contatos: {
        create: [
          ...(d.telefone
            ? [{ tipo: "TELEFONE" as const, valor: d.telefone, principal: true }]
            : []),
          ...(d.whatsapp
            ? [{ tipo: "WHATSAPP" as const, valor: d.whatsapp, principal: !d.telefone }]
            : []),
          ...(d.email ? [{ tipo: "EMAIL" as const, valor: d.email }] : []),
        ],
      },
    },
    select: { id: true },
  });

  // A descricao referencia o registro por identificador, nunca por conteudo:
  // `registrar` recusa descricao que contenha CPF, e-mail ou telefone.
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "cliente",
    entidadeId: cliente.id,
    descricao: `Cadastro de cliente criado (${d.tipoPessoa.toLowerCase()})`,
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export async function editarCliente(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("cliente", "editar");
  const id = String(dados.get("id") ?? "");
  if (!id) return { erro: "Registro nao identificado." };

  const antes = await prisma.cliente.findUnique({ where: { id } });
  if (!antes) return { erro: "Cliente nao encontrado." };

  const bruto = Object.fromEntries(
    CAMPOS_CLIENTE.map((campo) => [campo, opcional(dados.get(campo))]),
  );
  const analise = esquemaCliente.safeParse(bruto);

  if (!analise.success) {
    const campos: Record<string, string> = {};
    for (const problema of analise.error.issues) {
      const chave = String(problema.path[0] ?? "");
      if (chave && !campos[chave]) campos[chave] = problema.message;
    }
    return { erro: "Confira os campos destacados.", campos, valores: bruto };
  }

  const d = analise.data;
  const depois = {
    tipoPessoa: d.tipoPessoa,
    nome: d.nome,
    nomeSocial: d.nomeSocial || null,
    nomeFantasia: d.nomeFantasia || null,
    cpfCnpj: somenteDigitos(d.cpfCnpj),
    dataNascimento: d.dataNascimento ? new Date(d.dataNascimento) : null,
    estadoCivil: d.estadoCivil || null,
    profissao: d.profissao || null,
    origem: d.origem,
    origemDetalhe: d.origemDetalhe || null,
    unidadeResponsavel: d.unidadeResponsavel,
    observacoes: d.observacoes || null,
  };

  await prisma.cliente.update({ where: { id }, data: depois });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "ALTERACAO",
    entidade: "cliente",
    entidadeId: id,
    descricao: "Cadastro de cliente alterado",
    // Apenas os NOMES dos campos. Valores nunca entram no log.
    camposAlterados: camposAlterados(
      antes as unknown as Record<string, unknown>,
      depois as unknown as Record<string, unknown>,
    ),
  });

  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}
