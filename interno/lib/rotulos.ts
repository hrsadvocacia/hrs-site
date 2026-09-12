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

export const MODALIDADE_HONORARIOS: Record<string, string> = {
  FIXO: "Valor fixo",
  EXITO: "Êxito (percentual)",
  MISTO: "Misto (fixo + êxito)",
  PRO_LABORE_MAIS_EXITO: "Pró-labore + êxito",
  CONSULTIVO_MENSAL: "Consultivo mensal",
};

export const NATUREZA_HONORARIOS: Record<string, string> = {
  CONTRATUAL: "Contratual",
  SUCUMBENCIA: "Sucumbência (EAOAB art. 23)",
  CONTRATUAL_DESTACADO: "Contratual destacado (EAOAB art. 22, § 4º)",
};

export const STATUS_PARCELA: Record<string, string> = {
  A_VENCER: "A vencer",
  PAGO: "Paga",
  EM_ATRASO: "Em atraso",
  RENEGOCIADO: "Renegociada",
  CANCELADO: "Cancelada",
};

export const FORMA_PAGAMENTO: Record<string, string> = {
  PIX: "Pix",
  TRANSFERENCIA: "Transferência",
  BOLETO: "Boleto",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  DEPOSITO_JUDICIAL: "Depósito judicial",
};

export const MARCO_COBRANCA: Record<string, string> = {
  LEMBRETE_D5: "Vence em até 5 dias",
  VENCE_HOJE: "Vence hoje",
  ATRASO_D3: "3 a 9 dias de atraso",
  ATRASO_D10: "10 a 29 dias de atraso",
  ATRASO_D30: "30 dias ou mais de atraso",
};

export const CANAL_ATENDIMENTO: Record<string, string> = {
  PRESENCIAL: "Presencial",
  TELEFONE: "Telefone",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  VIDEOCHAMADA: "Videochamada",
  OUTRO: "Outro",
};

export const CATEGORIA_TEMPLATE: Record<string, string> = {
  RECEBIMENTO_DOCUMENTO: "Recebimento de documento",
  AUDIENCIA_DESIGNADA: "Audiência designada",
  MOVIMENTACAO_PROCESSO: "Movimentação no processo",
  CONVITE_REUNIAO: "Convite para reunião",
  COBRANCA_PARCELA: "Cobrança de parcela",
};

export const STATUS_ENVIO: Record<string, string> = {
  PENDENTE: "Aguardando envio",
  ENVIADO: "Enviada",
  ENTREGUE: "Entregue",
  LIDO: "Lida",
  FALHA: "Falha",
};

export const ORIGEM_SIMULADOR: Record<string, string> = {
  PRECATORIO_RPV: "Simulador de precatório/RPV",
  VERBAS_RESCISORIAS: "Simulador de verbas rescisórias",
  OUTRO: "Outro",
};

export const STATUS_LEAD: Record<string, string> = {
  AGUARDANDO_CONTATO: "Aguardando contato",
  EM_CONTATO: "Em contato",
  CONVERTIDO: "Convertido em cliente",
  DESCARTADO: "Descartado",
  SEM_CONSENTIMENTO: "Sem consentimento — não contatar",
};

export const TIPO_COMPROMISSO: Record<string, string> = {
  AUDIENCIA: "Audiência",
  PERICIA: "Perícia",
  REUNIAO: "Reunião",
  SUSTENTACAO_ORAL: "Sustentação oral",
  DILIGENCIA: "Diligência",
  OUTRO: "Outro",
};

export const STATUS_COMPROMISSO: Record<string, string> = {
  AGENDADO: "Agendado",
  REALIZADO: "Realizado",
  ADIADO: "Adiado",
  CANCELADO: "Cancelado",
};

export const CATEGORIA_DADO_SENSIVEL: Record<string, string> = {
  LAUDO_MEDICO: "Laudo médico",
  CID: "CID",
  EXAME: "Exame",
  ATESTADO: "Atestado",
  BENEFICIO_INSS: "Benefício do INSS",
  PERICIA_MEDICA: "Perícia médica",
  OUTRO: "Outro",
};

export const STATUS_ANTIVIRUS: Record<string, string> = {
  PENDENTE: "Sem verificação antivírus",
  LIMPO: "Verificado",
  INFECTADO: "Infectado — bloqueado",
  ERRO: "Erro na verificação",
};

export const ACAO_AUDITORIA: Record<string, string> = {
  LOGIN: "Acesso",
  LOGIN_FALHO: "Acesso recusado",
  LOGOUT: "Saída",
  LEITURA: "Leitura",
  ACESSO_DADO_SENSIVEL: "Leitura de dado sensível",
  CRIACAO: "Criação",
  ALTERACAO: "Alteração",
  INATIVACAO: "Inativação",
  EXPORTACAO: "Exportação",
  CONFIRMACAO_PRAZO: "Confirmação de prazo",
  CANCELAMENTO_PRAZO: "Cancelamento de prazo",
  TRIAGEM_PUBLICACAO: "Triagem de publicação",
  ENVIO_MENSAGEM: "Envio de mensagem",
  ALTERACAO_PERMISSAO: "Alteração de permissão",
  ANONIMIZACAO: "Anonimização",
  ACESSO_PORTAL: "Acesso ao portal do cliente",
};
