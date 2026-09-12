/**
 * Canais de envio.
 *
 * Regra do escritório: WhatsApp somente pela API oficial do WhatsApp Business,
 * com template aprovado pela Meta; e-mail por provedor contratado como
 * operador (LGPD art. 39). Nenhum dos dois contratos foi verificado com
 * resposta real ainda — e este sistema não escreve código "que provavelmente
 * funciona" contra API externa.
 *
 * Enquanto isso, o envio é ASSISTIDO: o sistema valida o template, preenche
 * as variáveis, registra a mensagem com autor e data, e mostra o texto pronto
 * para o advogado enviar pelo canal oficial (WhatsApp Business no aparelho do
 * escritório, e-mail institucional) e marcar como enviada. O registro fica
 * igual ao que ficaria com a API — o que muda é quem aperta o botão.
 *
 * Quando o contrato for verificado, implementa-se `CanalEnvio` aqui e
 * `canalAutomaticoDisponivel` passa a devolver true. Nada muda nas telas.
 */
export interface MensagemPronta {
  destinatario: string;
  corpo: string;
  /** Nome do template aprovado na Meta (só WhatsApp). */
  nomeTemplateWhatsapp?: string | null;
}

export interface CanalEnvio {
  readonly nome: "EMAIL" | "WHATSAPP";
  enviar(mensagem: MensagemPronta): Promise<{ idExterno: string }>;
}

export class ContratoNaoVerificadoError extends Error {
  constructor(canal: string) {
    super(`O canal ${canal} ainda não teve o contrato da API verificado com resposta real.`);
    this.name = "ContratoNaoVerificadoError";
  }
}

export function canalAutomaticoDisponivel(_canal: "EMAIL" | "WHATSAPP"): boolean {
  return false;
}

export function obterCanal(canal: "EMAIL" | "WHATSAPP"): CanalEnvio {
  return {
    nome: canal,
    async enviar() {
      throw new ContratoNaoVerificadoError(canal);
    },
  };
}
