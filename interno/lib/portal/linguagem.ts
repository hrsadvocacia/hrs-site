/**
 * Textos do portal do cliente, em linguagem simples.
 *
 * Tudo que o cliente lê aqui é texto FIXO deste arquivo ou registro de
 * movimentação já lançado pelo escritório. Não existe campo de previsão, de
 * estimativa nem de probabilidade — e o teste passa cada frase pela mesma
 * validação anti-promessa dos templates.
 */

export const SITUACAO_EM_LINGUAGEM_SIMPLES: Readonly<Record<string, string>> = {
  EM_ANDAMENTO: "Seu processo está em andamento. O escritório acompanha cada movimentação e avisa quando houver algo que dependa de você.",
  EM_EXECUCAO: "A decisão já foi dada e agora estamos na fase de cumprimento. Essa etapa tem trâmites próprios que o escritório acompanha.",
  SUSPENSO: "O processo está temporariamente parado por determinação do juízo. Isso é comum e não significa perda de direito.",
  ARQUIVADO: "O processo foi arquivado. Se tiver dúvidas sobre o que isso significa no seu caso, fale com o escritório.",
  BAIXADO: "O processo foi baixado, ou seja, devolvido à instância de origem para as providências seguintes.",
  EXTINTO: "O processo foi encerrado pelo juízo. O escritório pode explicar o motivo e as opções.",
  TRANSITADO_JULGADO: "A decisão se tornou definitiva: não cabe mais recurso.",
};

export const TEXTOS_PORTAL = {
  boasVindas: "Aqui você acompanha o andamento dos seus processos e as próximas audiências. As informações são atualizadas pelo escritório.",
  semPrevisao: "Não é possível prever quando um processo termina nem qual será o resultado: isso depende do juízo. O escritório informa cada movimentação relevante.",
  documentos: "Documentos disponibilizados pelo escritório para você. Guarde-os com cuidado: contêm dados pessoais.",
  contato: "Dúvidas? Fale diretamente com o escritório pelos canais oficiais. Este portal é somente para consulta.",
  semProcessos: "Ainda não há processo vinculado ao seu cadastro.",
  audiencia: "Compareça com antecedência e leve documento com foto. Se não puder ir, avise o escritório o quanto antes.",
  rodape: "Acesso individual e sigiloso. Não compartilhe este link.",
} as const;

export const GRAU_EM_LINGUAGEM_SIMPLES: Readonly<Record<string, string>> = {
  PRIMEIRO: "1ª instância (juiz)",
  SEGUNDO: "2ª instância (tribunal)",
  SUPERIOR: "tribunal superior (Brasília)",
  EXTRAORDINARIO: "instância extraordinária (Brasília)",
};
