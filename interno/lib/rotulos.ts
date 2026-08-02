/**
 * Rótulos de exibição.
 *
 * Valor de enum é identificador de banco, não texto de tela. "EM_ANDAMENTO" e
 * "PARTE_CONTRARIA" no lugar de "Em andamento" e "Parte contrária" é o tipo de
 * detalhe que faz um sistema parecer inacabado — e este vai ser usado todos os
 * dias por quem assina petição.
 *
 * Um lugar só para todos os rótulos: assim a tela de lista, a ficha e o
 * relatório nunca divergem no nome da mesma coisa.
 */

export const UNIDADE: Record<string, string> = {
  GOIANIA: "Goiânia – GO",
  TERESINA: "Teresina – PI",
  TIMON: "Timon – MA",
};

export const PERFIL: Record<string, string> = {
  SOCIO: "Sócio",
  ADVOGADO: "Advogado",
  ESTAGIARIO: "Estagiário",
  FINANCEIRO: "Financeiro",
  ADMIN: "Administração",
};

export const TIPO_PESSOA: Record<string, string> = {
  FISICA: "Pessoa física",
  JURIDICA: "Pessoa jurídica",
};

export const ORIGEM_CLIENTE: Record<string, string> = {
  INDICACAO: "Indicação",
  SIMULADOR_SITE: "Simulador do site",
  REDES_SOCIAIS: "Redes sociais",
  BALCAO: "Balcão",
  OUTRO: "Outro",
};

export const GRAU: Record<string, string> = {
  PRIMEIRO: "1º grau",
  SEGUNDO: "2º grau",
  SUPERIOR: "Instância superior",
  EXTRAORDINARIO: "Instância extraordinária",
};

export const SITUACAO_PROCESSO: Record<string, string> = {
  EM_ANDAMENTO: "Em andamento",
  EM_EXECUCAO: "Em execução",
  SUSPENSO: "Suspenso",
  ARQUIVADO: "Arquivado",
  BAIXADO: "Baixado",
  EXTINTO: "Extinto",
  TRANSITADO_JULGADO: "Transitado em julgado",
};

export const POLO: Record<string, string> = {
  ATIVO: "Ativo",
  PASSIVO: "Passivo",
  TERCEIRO_INTERESSADO: "Terceiro interessado",
};

export const TIPO_PARTE: Record<string, string> = {
  CLIENTE: "Cliente",
  PARTE_CONTRARIA: "Parte contrária",
  TERCEIRO: "Terceiro",
};

export const TIPO_CONTATO: Record<string, string> = {
  TELEFONE: "Telefone",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
};

export const ORIGEM_MOVIMENTACAO: Record<string, string> = {
  MANUAL: "Lançamento manual",
  PUBLICACAO: "Publicação",
  DATAJUD: "DataJud (CNJ)",
};

/** Devolve o rótulo; na falta dele, o próprio valor, para nunca exibir vazio. */
export function rotulo(mapa: Record<string, string>, valor: string): string {
  return mapa[valor] ?? valor;
}
