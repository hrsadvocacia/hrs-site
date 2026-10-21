/**
 * Retenção e anonimização (LGPD arts. 15 e 16).
 *
 * Nada é apagado por rotina automática sem que alguém veja antes. A rotina
 * LISTA o que venceu; a anonimização é ato de usuário com permissão, com
 * justificativa, registrado na auditoria. Exceção: lead que nunca pediu
 * contato e passou do prazo — aí não há relação jurídica que justifique
 * guardar nome e telefone, e a rotina anonimiza sozinha.
 *
 * Bases legais registradas no README e no próprio dado:
 *   - cliente/processo: art. 7º, V (contrato) e VI (exercício regular de
 *     direitos) — guarda enquanto durar a relação e o prazo prescricional;
 *   - saúde: art. 11, II, "d" — exercício regular de direitos em processo;
 *   - lead: art. 7º, I (consentimento) — descarte após RETENCAO_LEAD_DIAS.
 */
import type { DataISO } from "../prazos/dias.ts";

/** Prazo prescricional geral a contar do encerramento do processo (CC art. 205). */
export const RETENCAO_APOS_ENCERRAMENTO_ANOS = 10;

export interface RegistroComPrazo {
  id: string;
  descartarApos: DataISO | null;
  anonimizadoEm: Date | null;
}

export function vencidos<T extends RegistroComPrazo>(registros: readonly T[], hoje: DataISO): T[] {
  return registros.filter((r) => r.descartarApos !== null && r.descartarApos <= hoje && r.anonimizadoEm === null);
}

/** Substitutos que preservam a estrutura e apagam a identificação. */
export function anonimizarLead(id: string): { nome: string; whatsapp: string; email: null; payload: Record<string, never>; origemUtm: null } {
  return {
    nome: `Lead anonimizado ${id.slice(0, 8)}`,
    whatsapp: "00000000000",
    email: null,
    payload: {},
    origemUtm: null,
  };
}

export function anonimizarCliente(id: string) {
  return {
    nome: `Titular anonimizado ${id.slice(0, 8)}`,
    nomeSocial: null,
    nomeFantasia: null,
    // CPF/CNPJ é único no banco: o substituto precisa ser único e inválido.
    cpfCnpj: `ANON-${id}`,
    rg: null,
    orgaoExpedidor: null,
    dataNascimento: null,
    estadoCivil: null,
    profissao: null,
    observacoes: null,
    ativo: false,
  };
}

/**
 * Relatório de dados do titular (art. 18, II): tudo que o sistema guarda
 * sobre a pessoa, agrupado por finalidade e base legal. Devolve estrutura
 * pronta para impressão; quem chama preenche com os registros.
 */
export interface SecaoRelatorioTitular {
  finalidade: string;
  baseLegal: string;
  campos: Array<{ rotulo: string; valor: string }>;
}
