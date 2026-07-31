/**
 * Controle de acesso por perfil (RBAC).
 *
 * A matriz e declarativa e fica em UM lugar so, porque permissao espalhada por
 * `if` em componente e permissao que ninguem consegue auditar. `podeOuFalha`
 * lanca em vez de devolver falso para que a omissao de checagem no chamador
 * quebre alto, e nao vaze dado em silencio.
 *
 * Regras de produto codificadas aqui (cobertas por lib/rbac.test.ts):
 *   - ESTAGIARIO nao acessa financeiro e NAO PODE CONFIRMAR PRAZO;
 *   - FINANCEIRO nao acessa estrategia processual nem documento sensivel;
 *   - so SOCIO e ADVOGADO confirmam prazo (o sistema assiste, o advogado decide);
 *   - ADMIN administra o sistema, mas nao le dado sensivel de saude.
 */

export type Perfil = "SOCIO" | "ADVOGADO" | "ESTAGIARIO" | "FINANCEIRO" | "ADMIN";

export type Recurso =
  | "cliente"
  | "processo"
  | "anotacaoPrivilegiada"
  | "dadoSensivel"
  | "prazo"
  | "publicacao"
  | "calendario"
  | "agenda"
  | "atendimento"
  | "financeiro"
  | "documento"
  | "documentoSensivel"
  | "templateMensagem"
  | "usuario"
  | "auditoria"
  | "relatorioSocio";

export type Acao = "ler" | "criar" | "editar" | "confirmar" | "exportar" | "inativar";

const TODAS: readonly Acao[] = ["ler", "criar", "editar", "confirmar", "exportar", "inativar"];
const LEITURA: readonly Acao[] = ["ler"];
const NENHUMA: readonly Acao[] = [];

type Matriz = Readonly<Record<Perfil, Readonly<Record<Recurso, readonly Acao[]>>>>;

export const MATRIZ_PERMISSOES: Matriz = {
  // Socio enxerga o escritorio inteiro, inclusive metrica de risco.
  SOCIO: {
    cliente: TODAS,
    processo: TODAS,
    anotacaoPrivilegiada: TODAS,
    dadoSensivel: ["ler", "criar", "editar"],
    prazo: TODAS,
    publicacao: TODAS,
    calendario: LEITURA,
    agenda: TODAS,
    atendimento: TODAS,
    financeiro: TODAS,
    documento: TODAS,
    documentoSensivel: TODAS,
    templateMensagem: TODAS,
    usuario: LEITURA,
    auditoria: ["ler", "exportar"],
    relatorioSocio: ["ler", "exportar"],
  },

  ADVOGADO: {
    cliente: ["ler", "criar", "editar"],
    processo: ["ler", "criar", "editar"],
    anotacaoPrivilegiada: ["ler", "criar", "editar"],
    dadoSensivel: ["ler", "criar", "editar"],
    prazo: ["ler", "criar", "editar", "confirmar"],
    publicacao: ["ler", "editar", "confirmar"],
    calendario: LEITURA,
    agenda: ["ler", "criar", "editar"],
    atendimento: ["ler", "criar", "editar"],
    // Ve a situacao financeira dos proprios contratos, mas nao movimenta caixa.
    financeiro: LEITURA,
    documento: ["ler", "criar", "editar"],
    documentoSensivel: ["ler", "criar", "editar"],
    templateMensagem: LEITURA,
    usuario: NENHUMA,
    auditoria: NENHUMA,
    relatorioSocio: NENHUMA,
  },

  // Estagiario instrui processo sob supervisao. Nao confirma prazo e nao ve
  // financeiro — sao as duas fronteiras pedidas pelo escritorio.
  ESTAGIARIO: {
    cliente: ["ler", "criar", "editar"],
    processo: ["ler", "criar", "editar"],
    anotacaoPrivilegiada: ["ler", "criar"],
    dadoSensivel: NENHUMA,
    prazo: ["ler", "criar"],
    publicacao: ["ler"],
    calendario: LEITURA,
    agenda: ["ler", "criar"],
    atendimento: ["ler", "criar"],
    financeiro: NENHUMA,
    documento: ["ler", "criar"],
    documentoSensivel: NENHUMA,
    templateMensagem: NENHUMA,
    usuario: NENHUMA,
    auditoria: NENHUMA,
    relatorioSocio: NENHUMA,
  },

  // Financeiro cuida de honorarios. Nao ve estrategia processual nem documento
  // sensivel: o cadastro e o contrato bastam para cobrar.
  FINANCEIRO: {
    cliente: ["ler", "editar"],
    processo: LEITURA,
    anotacaoPrivilegiada: NENHUMA,
    dadoSensivel: NENHUMA,
    prazo: NENHUMA,
    publicacao: NENHUMA,
    calendario: NENHUMA,
    agenda: NENHUMA,
    atendimento: LEITURA,
    financeiro: TODAS,
    documento: ["ler", "criar"],
    documentoSensivel: NENHUMA,
    templateMensagem: LEITURA,
    usuario: NENHUMA,
    auditoria: NENHUMA,
    relatorioSocio: NENHUMA,
  },

  // ADMIN administra contas e calendario. NAO le dado de cliente: administrar o
  // sistema nao e motivo legitimo para acessar sigilo profissional nem saude.
  ADMIN: {
    cliente: NENHUMA,
    processo: NENHUMA,
    anotacaoPrivilegiada: NENHUMA,
    dadoSensivel: NENHUMA,
    prazo: NENHUMA,
    publicacao: NENHUMA,
    calendario: TODAS,
    agenda: NENHUMA,
    atendimento: NENHUMA,
    financeiro: NENHUMA,
    documento: NENHUMA,
    documentoSensivel: NENHUMA,
    templateMensagem: NENHUMA,
    usuario: TODAS,
    auditoria: ["ler", "exportar"],
    relatorioSocio: NENHUMA,
  },
};

export function pode(perfil: Perfil, recurso: Recurso, acao: Acao): boolean {
  return MATRIZ_PERMISSOES[perfil][recurso].includes(acao);
}

/** Erro de autorizacao. A mensagem exibida nunca cita dado de cliente. */
export class AcessoNegadoError extends Error {
  readonly perfil: Perfil;
  readonly recurso: Recurso;
  readonly acao: Acao;

  constructor(perfil: Perfil, recurso: Recurso, acao: Acao) {
    super(`Perfil ${perfil} nao tem permissao para ${acao} em ${recurso}.`);
    this.name = "AcessoNegadoError";
    this.perfil = perfil;
    this.recurso = recurso;
    this.acao = acao;
  }
}

/**
 * Use nas server actions e route handlers. Lanca em vez de devolver booleano
 * para que esquecer de tratar o retorno resulte em bloqueio, e nao em vazamento.
 */
export function podeOuFalha(perfil: Perfil, recurso: Recurso, acao: Acao): void {
  if (!pode(perfil, recurso, acao)) {
    throw new AcessoNegadoError(perfil, recurso, acao);
  }
}

/**
 * Confirmacao de prazo e ato privativo de advogado. Existe como funcao propria
 * porque e a regra mais importante do produto e merece um ponto unico de
 * verificacao, citado no codigo e no teste.
 */
export function podeConfirmarPrazo(perfil: Perfil): boolean {
  return pode(perfil, "prazo", "confirmar");
}
