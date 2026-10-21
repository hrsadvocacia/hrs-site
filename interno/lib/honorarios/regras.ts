/**
 * Regras de honorários — serviço puro, sem banco.
 *
 * Três decisões de produto vivem aqui e são cobertas por teste:
 *   1. Sucumbência (EAOAB art. 23), contratual e contratual destacado
 *      (EAOAB art. 22, § 4º) são naturezas DISTINTAS. `consolidar` devolve
 *      cada uma em separado e NÃO oferece um "total geral" — quem quiser
 *      somar tem que fazê-lo explicitamente, sabendo o que está somando.
 *   2. Provisão de êxito é expectativa, nunca receita realizada. Nenhum
 *      lançamento com `provisao = true` entra em "realizado", mesmo que alguém
 *      marque `recebido` por engano (o banco também recusa — CHECK
 *      `provisao_nao_e_receita`).
 *   3. A régua de cobrança LISTA o que está vencendo. Não dispara mensagem:
 *      cobrar é ato de pessoa identificada, com template validado.
 */
import { somarDias, type DataISO } from "../prazos/dias.ts";

export type Modalidade =
  | "FIXO"
  | "EXITO"
  | "MISTO"
  | "PRO_LABORE_MAIS_EXITO"
  | "CONSULTIVO_MENSAL";

export type Natureza = "CONTRATUAL" | "SUCUMBENCIA" | "CONTRATUAL_DESTACADO";

export const NATUREZAS: readonly Natureza[] = [
  "CONTRATUAL",
  "SUCUMBENCIA",
  "CONTRATUAL_DESTACADO",
];

export interface CamposModalidade {
  valorFixo?: number | null;
  percentualExito?: number | null;
  valorProLabore?: number | null;
  valorMensal?: number | null;
}

/**
 * Cada modalidade exige exatamente os campos que a definem. Contrato de êxito
 * com valor fixo preenchido é sinal de cadastro errado, não de flexibilidade.
 */
export function validarModalidade(
  modalidade: Modalidade,
  campos: CamposModalidade,
): string[] {
  const erros: string[] = [];
  const tem = (v: number | null | undefined) => v !== null && v !== undefined && v > 0;
  const exigir = (nome: keyof CamposModalidade, rotulo: string) => {
    if (!tem(campos[nome])) erros.push(`${rotulo} é obrigatório nesta modalidade.`);
  };
  const vedar = (nome: keyof CamposModalidade, rotulo: string) => {
    if (tem(campos[nome])) erros.push(`${rotulo} não se aplica a esta modalidade.`);
  };

  switch (modalidade) {
    case "FIXO":
      exigir("valorFixo", "Valor fixo");
      vedar("percentualExito", "Percentual de êxito");
      vedar("valorProLabore", "Pró-labore");
      vedar("valorMensal", "Valor mensal");
      break;
    case "EXITO":
      exigir("percentualExito", "Percentual de êxito");
      vedar("valorFixo", "Valor fixo");
      vedar("valorProLabore", "Pró-labore");
      vedar("valorMensal", "Valor mensal");
      break;
    case "MISTO":
      exigir("valorFixo", "Valor fixo");
      exigir("percentualExito", "Percentual de êxito");
      vedar("valorProLabore", "Pró-labore");
      vedar("valorMensal", "Valor mensal");
      break;
    case "PRO_LABORE_MAIS_EXITO":
      exigir("valorProLabore", "Pró-labore");
      exigir("percentualExito", "Percentual de êxito");
      vedar("valorFixo", "Valor fixo");
      vedar("valorMensal", "Valor mensal");
      break;
    case "CONSULTIVO_MENSAL":
      exigir("valorMensal", "Valor mensal");
      vedar("valorFixo", "Valor fixo");
      vedar("percentualExito", "Percentual de êxito");
      vedar("valorProLabore", "Pró-labore");
      break;
  }

  const p = campos.percentualExito;
  if (p !== null && p !== undefined && (p <= 0 || p > 100)) {
    erros.push("Percentual de êxito deve estar entre 0 e 100.");
  }
  return erros;
}

export interface ParcelaGerada {
  numero: number;
  valorCentavos: number;
  vencimento: DataISO;
}

/**
 * Divide um total em N parcelas mensais. O resto da divisão inteira vai para a
 * ÚLTIMA parcela, de modo que a soma bate com o total ao centavo. O vencimento
 * mantém o dia do mês; quando o mês não tem esse dia, cai no último dia dele.
 */
export function gerarParcelas(params: {
  totalCentavos: number;
  quantidade: number;
  primeiroVencimento: DataISO;
}): ParcelaGerada[] {
  const { totalCentavos, quantidade, primeiroVencimento } = params;
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 120) {
    throw new Error("Quantidade de parcelas deve ser entre 1 e 120.");
  }
  if (!Number.isInteger(totalCentavos) || totalCentavos <= 0) {
    throw new Error("Total a parcelar deve ser positivo.");
  }
  const base = Math.floor(totalCentavos / quantidade);
  const resto = totalCentavos - base * quantidade;

  const [anoStr, mesStr, diaStr] = primeiroVencimento.split("-");
  const ano0 = Number(anoStr);
  const mes0 = Number(mesStr);
  const diaDesejado = Number(diaStr);

  const parcelas: ParcelaGerada[] = [];
  for (let i = 0; i < quantidade; i++) {
    const indiceMes = mes0 - 1 + i;
    const ano = ano0 + Math.floor(indiceMes / 12);
    const mes = (indiceMes % 12) + 1;
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dia = Math.min(diaDesejado, ultimoDia);
    parcelas.push({
      numero: i + 1,
      valorCentavos: base + (i === quantidade - 1 ? resto : 0),
      vencimento: `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
    });
  }
  return parcelas;
}

export type StatusParcela = "A_VENCER" | "PAGO" | "EM_ATRASO" | "RENEGOCIADO" | "CANCELADO";

/**
 * Situação efetiva da parcela. `EM_ATRASO` é DERIVADO: uma parcela a vencer
 * cujo vencimento já passou está em atraso hoje, sem depender de job que
 * atualize status no banco — se o job falhar, a tela continua certa.
 */
export function situacaoParcela(
  parcela: { status: StatusParcela; vencimento: DataISO },
  hoje: DataISO,
): StatusParcela {
  if (parcela.status === "A_VENCER" && parcela.vencimento < hoje) return "EM_ATRASO";
  return parcela.status;
}

export interface LancamentoParaConsolidar {
  natureza: Natureza;
  valorCentavos: number;
  provisao: boolean;
  recebido: boolean;
}

export interface ConsolidadoNatureza {
  /** Recebido de fato — e somente isso é receita. */
  realizadoCentavos: number;
  /** Reconhecido e ainda não recebido (não provisão). */
  aReceberCentavos: number;
  /** Expectativa de êxito. Não é receita. Não entra em nenhuma soma acima. */
  provisionadoCentavos: number;
  quantidade: number;
}

export type Consolidado = Record<Natureza, ConsolidadoNatureza>;

/**
 * Consolida POR NATUREZA. Deliberadamente não devolve "total geral":
 * sucumbência pertence ao advogado, contratual ao contrato, destacado é
 * retido na execução — somar os três num número só esconde de quem é o
 * dinheiro. (Teste garante que nenhuma chave de total existe no retorno.)
 */
export function consolidar(lancamentos: readonly LancamentoParaConsolidar[]): Consolidado {
  const vazio = (): ConsolidadoNatureza => ({
    realizadoCentavos: 0,
    aReceberCentavos: 0,
    provisionadoCentavos: 0,
    quantidade: 0,
  });
  const c: Consolidado = {
    CONTRATUAL: vazio(),
    SUCUMBENCIA: vazio(),
    CONTRATUAL_DESTACADO: vazio(),
  };
  for (const l of lancamentos) {
    const alvo = c[l.natureza];
    alvo.quantidade++;
    if (l.provisao) {
      // Provisão jamais é realizado, ainda que `recebido` venha marcado.
      alvo.provisionadoCentavos += l.valorCentavos;
    } else if (l.recebido) {
      alvo.realizadoCentavos += l.valorCentavos;
    } else {
      alvo.aReceberCentavos += l.valorCentavos;
    }
  }
  return c;
}

export type MarcoCobranca =
  | "LEMBRETE_D5"
  | "VENCE_HOJE"
  | "ATRASO_D3"
  | "ATRASO_D10"
  | "ATRASO_D30";

export interface ItemRegua<T> {
  parcela: T;
  marco: MarcoCobranca;
  diasParaVencer: number;
}

/**
 * Régua de cobrança: classifica parcelas em aberto pelo marco mais avançado.
 * Só lista. Quem cobra é gente, por template validado, um cliente por vez.
 */
export function reguaCobranca<T extends { status: StatusParcela; vencimento: DataISO }>(
  parcelas: readonly T[],
  hoje: DataISO,
): ItemRegua<T>[] {
  const itens: ItemRegua<T>[] = [];
  for (const p of parcelas) {
    if (p.status !== "A_VENCER") continue;
    const dias = diferenca(hoje, p.vencimento);
    let marco: MarcoCobranca | null = null;
    if (dias <= -30) marco = "ATRASO_D30";
    else if (dias <= -10) marco = "ATRASO_D10";
    else if (dias <= -3) marco = "ATRASO_D3";
    else if (dias === 0) marco = "VENCE_HOJE";
    else if (dias > 0 && dias <= 5) marco = "LEMBRETE_D5";
    if (marco) itens.push({ parcela: p, marco, diasParaVencer: dias });
  }
  return itens.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
}

function diferenca(de: DataISO, ate: DataISO): number {
  return Math.round(
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000,
  );
}

/** Reexportado para quem monta a régua a partir de "hoje". */
export { somarDias };
