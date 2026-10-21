/**
 * Limitação de tentativas — lógica pura da janela deslizante.
 *
 * O contador precisa ser COMPARTILHADO entre instâncias: na Vercel cada
 * requisição pode cair num processo diferente, e um limitador em memória
 * protegeria apenas a instância que por acaso atendeu — ou seja, não
 * protegeria. O estado mora no Postgres (é o armazém que já existe; um Redis
 * seria mais uma dependência e mais um contrato para manter).
 *
 * A janela é deslizante por aproximação: guarda-se o início da janela e a
 * contagem. Passada a janela, ela reinicia. É o suficiente para o que o
 * limitador precisa impedir — alguém varrendo senhas de uma conta ou testando
 * códigos TOTP em série.
 */
export interface EstadoJanela {
  inicio: Date;
  contagem: number;
}

export interface Politica {
  /** Tentativas permitidas dentro da janela. */
  maximo: number;
  /** Duração da janela, em segundos. */
  janelaSegundos: number;
}

/** Login: 10 tentativas por IP a cada 5 minutos. */
export const POLITICA_LOGIN: Politica = { maximo: 10, janelaSegundos: 300 };

/** Portal do cliente: 30 aberturas por IP a cada 5 minutos. */
export const POLITICA_PORTAL: Politica = { maximo: 30, janelaSegundos: 300 };

export interface Decisao {
  permitido: boolean;
  /** Novo estado a gravar. */
  estado: EstadoJanela;
  /** Quantas tentativas ainda cabem na janela. */
  restantes: number;
  /** Segundos até a janela reabrir, quando bloqueado. */
  esperaSegundos: number;
}

export function avaliar(
  atual: EstadoJanela | null,
  politica: Politica,
  agora: Date = new Date(),
): Decisao {
  const expirou =
    atual === null ||
    agora.getTime() - atual.inicio.getTime() >= politica.janelaSegundos * 1000;

  if (expirou) {
    return {
      permitido: true,
      estado: { inicio: agora, contagem: 1 },
      restantes: politica.maximo - 1,
      esperaSegundos: 0,
    };
  }

  const contagem = atual.contagem + 1;
  const permitido = contagem <= politica.maximo;
  const fim = atual.inicio.getTime() + politica.janelaSegundos * 1000;
  return {
    permitido,
    // Continua contando depois do limite: assim uma rajada longa mantém a
    // porta fechada até o fim da janela, em vez de reabrir a cada tentativa.
    estado: { inicio: atual.inicio, contagem },
    restantes: Math.max(0, politica.maximo - contagem),
    esperaSegundos: permitido ? 0 : Math.ceil((fim - agora.getTime()) / 1000),
  };
}

/**
 * Chave do limitador. O IP entra HASHEADO — endereço de IP é dado pessoal
 * (LGPD art. 5º, I, e Marco Civil art. 13), e a tabela de limitação não
 * precisa saber de quem é: precisa apenas distinguir um de outro.
 */
export function chaveDe(escopo: string, identificador: string, segredo: string): string {
  return `${escopo}:${hmacCurto(identificador, segredo)}`;
}

import { createHmac } from "node:crypto";

function hmacCurto(valor: string, segredo: string): string {
  return createHmac("sha256", segredo).update(valor).digest("base64url").slice(0, 22);
}
