/**
 * Servico de log de auditoria.
 *
 * O log e append-only no banco (trigger + REVOKE na migration de invariantes);
 * esta camada garante o outro lado do contrato: que o que se GRAVA nao contenha
 * dado pessoal de cliente. O log responde "quem fez o que e quando", nao
 * "qual era o conteudo" — para o conteudo existe o registro em si.
 */
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AcaoAuditoria } from "@/generated/prisma/enums";
import { conferirDescricao } from "@/lib/auditoria-regras";

export {
  camposAlterados,
  conferirDescricao,
  DadoPessoalNoLogError,
} from "@/lib/auditoria-regras";

export interface RegistroAuditoria {
  usuarioId: string | null;
  usuarioEmail: string;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  descricao: string;
  /** Apenas os NOMES dos campos alterados. Valores jamais entram. */
  camposAlterados?: readonly string[];
  sucesso?: boolean;
}

/**
 * O e-mail do PROPRIO usuario autenticado e identidade funcional do escritorio,
 * nao dado de cliente — por isso e gravado em coluna dedicada e nao passa pelo
 * filtro da descricao.
 */
export async function registrar(entrada: RegistroAuditoria): Promise<void> {
  conferirDescricao(entrada.descricao);

  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const cabecalhos = await headers();
    ip =
      cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      cabecalhos.get("x-real-ip") ??
      null;
    userAgent = cabecalhos.get("user-agent");
  } catch {
    // Fora de um request (job de cron, seed): sem cabecalhos, e tudo bem.
  }

  await prisma.auditoria.create({
    data: {
      usuarioId: entrada.usuarioId,
      usuarioEmail: entrada.usuarioEmail,
      acao: entrada.acao,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId ?? null,
      descricao: entrada.descricao,
      camposAlterados: [...(entrada.camposAlterados ?? [])],
      sucesso: entrada.sucesso ?? true,
      ip,
      userAgent,
    },
  });
}

/**
 * Leitura de dado sensivel de saude e registrada DUAS vezes: na auditoria geral
 * e em `acesso_dado_sensivel`, que existe para responder "quem leu o laudo do
 * cliente X" sem varrer a auditoria inteira. Ambas as tabelas sao append-only.
 */
export async function registrarAcessoDadoSensivel(params: {
  dadoId: string;
  usuarioId: string;
  usuarioEmail: string;
  finalidade?: string;
}): Promise<void> {
  let ip: string | null = null;
  try {
    const cabecalhos = await headers();
    ip = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  } catch {
    /* fora de request */
  }

  await prisma.$transaction([
    prisma.acessoDadoSensivel.create({
      data: {
        dadoId: params.dadoId,
        usuarioId: params.usuarioId,
        finalidade: params.finalidade ?? null,
        ip,
      },
    }),
    prisma.auditoria.create({
      data: {
        usuarioId: params.usuarioId,
        usuarioEmail: params.usuarioEmail,
        acao: "ACESSO_DADO_SENSIVEL",
        entidade: "dado_sensivel_cliente",
        entidadeId: params.dadoId,
        descricao: "Leitura de dado sensivel de saude (LGPD art. 11, II, d)",
        ip,
      },
    }),
  ]);
}
