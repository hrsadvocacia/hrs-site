/**
 * Motor de contagem de prazos — servico PURO.
 *
 * Sem banco, sem UI, sem relogio: tudo entra por parametro. E o unico jeito de
 * exercitar virada de ano, feriado municipal e ponto facultativo sem subir a
 * aplicacao inteira.
 *
 * REGRA DE OURO DA SAIDA: o resultado nunca e "a data". E a data MAIS os
 * insumos que a produziram — disponibilizacao, publicacao considerada, inicio
 * da contagem, dias contados, feriados aplicados, fundamento legal e premissas.
 * A tela mostra tudo isso. O advogado confere e decide; o sistema so assiste.
 */
import {
  type Calendario,
  type DiaSemExpediente,
  temExpediente,
} from "./calendario.ts";
import {
  type DataISO,
  formatarBR,
  noRecesso,
  primeiroDiaAposRecesso,
  proximoDia,
  validarDataISO,
} from "./dias.ts";

export const VERSAO_MOTOR = "motor-1.0.0";

export type RegimeContagem =
  | "DIAS_UTEIS_TRABALHISTA"
  | "DIAS_UTEIS_CPC"
  | "DIAS_CORRIDOS_PENAL"
  | "DIAS_CORRIDOS";

interface ConfiguracaoRegime {
  /** Conta apenas dias com expediente. */
  diasUteis: boolean;
  /** O recesso de 20/12 a 20/01 suspende o curso? */
  suspendeNoRecesso: boolean;
  /**
   * O termo inicial espera o primeiro dia util?
   *
   * Judicial: sim (CPC art. 224, 3o; Sumula 310 do STF para o penal).
   * Administrativo/material: NAO — o prazo corre do dia seguinte a
   * cientificacao (Lei 9.784/1999, art. 66). Adiar o inicio aqui produziria
   * data fatal POSTERIOR a real, que e o erro perigoso.
   */
  inicioNoPrimeiroDiaUtil: boolean;
  fundamento: string;
}

const REGIMES: Record<RegimeContagem, ConfiguracaoRegime> = {
  DIAS_UTEIS_TRABALHISTA: {
    diasUteis: true,
    suspendeNoRecesso: true,
    inicioNoPrimeiroDiaUtil: true,
    fundamento:
      "CLT art. 775 (redacao da Lei 13.467/2017) — contagem em dias úteis; " +
      "suspensão de 20/12 a 20/01 pelo art. 775-A da CLT",
  },
  DIAS_UTEIS_CPC: {
    diasUteis: true,
    suspendeNoRecesso: true,
    inicioNoPrimeiroDiaUtil: true,
    fundamento:
      "CPC art. 219 — contagem em dias úteis; suspensão de 20/12 a 20/01 " +
      "pelo art. 220 do CPC",
  },
  DIAS_CORRIDOS_PENAL: {
    diasUteis: false,
    suspendeNoRecesso: false,
    inicioNoPrimeiroDiaUtil: true,
    fundamento:
      "CPP art. 798 — prazos contínuos e peremptórios, que não se suspendem " +
      "no recesso; inicio no primeiro dia útil (Súmula 310 do STF)",
  },
  DIAS_CORRIDOS: {
    diasUteis: false,
    suspendeNoRecesso: false,
    inicioNoPrimeiroDiaUtil: false,
    fundamento:
      "Prazo material ou administrativo em dias corridos (Lei 9.784/1999, " +
      "art. 66) — não se suspende no recesso forense, que e instituto do " +
      "processo judicial",
  },
};

export interface EntradaCalculo {
  /** Data de disponibilizacao no diario eletronico, quando houver. */
  dataDisponibilizacao?: string;
  /**
   * Publicacao ja conhecida. Use quando a ciencia nao veio de diario
   * (intimacao pessoal, carga, ciencia nos autos).
   */
  dataPublicacao?: string;
  prazoDias: number;
  regime: RegimeContagem;
  calendario: Calendario;
}

export interface FeriadoAplicado {
  data: DataISO;
  nome: string;
  origem: string;
  fonte: string;
}

export interface ResultadoCalculo {
  dataFatal: DataISO;
  dataPublicacaoConsiderada: DataISO;
  dataInicioContagem: DataISO;
  /** Dias efetivamente contados ate a data fatal. */
  diasUteisContados: number;
  feriadosAplicados: FeriadoAplicado[];
  fundamentoLegal: string;
  /** Cada decisao tomada pelo motor, em portugues, para conferencia humana. */
  premissas: string[];
  versaoMotor: string;
  calendarioIdentificacao: string;
}

/** Guarda contra calendario mal preenchido que marque tudo sem expediente. */
const LIMITE_ITERACOES = 4000;

function proximoComExpediente(calendario: Calendario, apartirDe: DataISO): DataISO {
  let atual = apartirDe;
  for (let i = 0; i < LIMITE_ITERACOES; i++) {
    if (temExpediente(calendario, atual)) return atual;
    atual = proximoDia(atual);
  }
  throw new Error(
    "Não foi encontrado dia com expediente em 4000 dias. " +
      "O calendário do tribunal provavelmente esta mal preenchido.",
  );
}

export function calcularPrazo(entrada: EntradaCalculo): ResultadoCalculo {
  const config = REGIMES[entrada.regime];
  if (!config) {
    throw new Error(`Regime de contagem desconhecido: ${entrada.regime}`);
  }
  if (!Number.isInteger(entrada.prazoDias) || entrada.prazoDias < 1) {
    throw new Error("O prazo em dias deve ser um inteiro maior que zero.");
  }
  if (!entrada.dataDisponibilizacao && !entrada.dataPublicacao) {
    throw new Error(
      "Informe a data de disponibilização ou a data de publicação.",
    );
  }

  const premissas: string[] = [];
  const feriados = new Map<DataISO, FeriadoAplicado>();
  /** O recesso nao e um dia do calendario, e um periodo: fica a parte. */
  let recessoAplicado: FeriadoAplicado | null = null;
  const fonteRecesso =
    entrada.regime === "DIAS_UTEIS_TRABALHISTA" ? "CLT art. 775-A" : "CPC art. 220";

  const registrar = (d: DiaSemExpediente) => {
    if (!feriados.has(d.data)) {
      feriados.set(d.data, {
        data: d.data,
        nome: d.nome,
        origem: d.origem,
        fonte: d.fonte,
      });
    }
  };

  // ---------------------------------------------------------------- publicacao
  // Lei 11.419/2006, art. 4o, 3o: considera-se PUBLICADA no primeiro dia util
  // seguinte ao da disponibilizacao. Publicacao nao e disponibilizacao — e a
  // confusao entre as duas que encurta prazo na pratica.
  let publicacao: DataISO;
  if (entrada.dataDisponibilizacao) {
    const disponibilizacao = validarDataISO(entrada.dataDisponibilizacao);
    publicacao = proximoComExpediente(
      entrada.calendario,
      proximoDia(disponibilizacao),
    );
    premissas.push(
      `Disponibilizado no diario eletronico em ${formatarBR(disponibilizacao)}.`,
    );
    premissas.push(
      `Considera-se publicado em ${formatarBR(publicacao)}, primeiro dia util ` +
        `seguinte a disponibilizacao (Lei 11.419/2006, art. 4o, 3o).`,
    );
    if (entrada.dataPublicacao) {
      premissas.push(
        "Data de publicação informada manualmente foi ignorada: havendo " +
          "disponibilização, a publicação e calculada por lei.",
      );
    }
  } else {
    publicacao = validarDataISO(entrada.dataPublicacao!);
    premissas.push(
      `Ciencia considerada em ${formatarBR(publicacao)} (informada, sem ` +
        `disponibilizacao em diario).`,
    );
  }

  // ----------------------------------------------------------- inicio da contagem
  let inicio: DataISO;
  if (config.inicioNoPrimeiroDiaUtil) {
    inicio = proximoComExpediente(entrada.calendario, proximoDia(publicacao));
    premissas.push(
      `Contagem iniciada em ${formatarBR(inicio)}, primeiro dia util seguinte ` +
        `ao da publicacao (exclui-se o dia do comeco).`,
    );
  } else {
    inicio = proximoDia(publicacao);
    premissas.push(
      `Contagem iniciada em ${formatarBR(inicio)}, dia seguinte a ciencia ` +
        `(exclui-se o dia do comeco; prazo em dias corridos nao aguarda dia util).`,
    );
  }

  // O recesso empurra o TERMO INICIAL: prazo cujo inicio cairia entre 20/12 e
  // 20/01 so comeca a correr depois que a suspensao termina.
  if (config.suspendeNoRecesso && noRecesso(inicio)) {
    const retomada = primeiroDiaAposRecesso(inicio);
    const novoInicio = proximoComExpediente(entrada.calendario, retomada);
    premissas.push(
      `Inicio adiado para ${formatarBR(novoInicio)}: o termo inicial cairia ` +
        `dentro do recesso forense (20/12 a 20/01), quando o prazo esta suspenso.`,
    );
    recessoAplicado = {
      data: inicio,
      nome: "Recesso forense (20/12 a 20/01) — termo inicial adiado",
      origem: "RECESSO",
      fonte: fonteRecesso,
    };
    inicio = novoInicio;
  }

  // ------------------------------------------------------------------- contagem
  let atual = inicio;
  let contados = 0;
  let atravessouRecesso = false;
  let iteracoes = 0;

  while (contados < entrada.prazoDias) {
    if (++iteracoes > LIMITE_ITERACOES) {
      throw new Error(
        "Contagem excedeu o limite de seguranca. Calendário provavelmente " +
          "mal preenchido.",
      );
    }

    const suspenso = config.suspendeNoRecesso && noRecesso(atual);
    if (suspenso) {
      atravessouRecesso = true;
      // Suspensao NAO zera o que ja correu: os dias contados antes de 20/12
      // sao preservados e a contagem retoma de onde parou em 21/01.
      atual = proximoComExpediente(
        entrada.calendario,
        primeiroDiaAposRecesso(atual),
      );
      continue;
    }

    if (config.diasUteis) {
      const semExpediente = entrada.calendario.diaSemExpediente(atual);
      if (semExpediente) registrar(semExpediente);
      if (temExpediente(entrada.calendario, atual)) {
        contados++;
        if (contados === entrada.prazoDias) break;
      }
    } else {
      // Dias corridos: todo dia conta, mas os feriados atravessados sao
      // registrados assim mesmo — o advogado precisa ver o que houve na janela.
      const semExpediente = entrada.calendario.diaSemExpediente(atual);
      if (semExpediente) registrar(semExpediente);
      contados++;
      if (contados === entrada.prazoDias) break;
    }

    atual = proximoDia(atual);
  }

  let fatal = atual;

  if (atravessouRecesso) {
    premissas.push(
      "A contagem atravessou o recesso forense (20/12 a 20/01): o curso ficou " +
        "suspenso e retomou de onde parou, preservando os dias já decorridos.",
    );
    recessoAplicado ??= {
      data: inicio,
      nome: "Recesso forense (20/12 a 20/01) — curso suspenso e retomado",
      origem: "RECESSO",
      fonte: fonteRecesso,
    };
  }

  // ---------------------------------------------------------------- prorrogacao
  // Prazo que termina em dia sem expediente prorroga para o proximo dia util
  // (CPC art. 224, 1o; CLT art. 775, 1o; CPP art. 798, 3o). Na contagem em dias
  // uteis o ultimo dia ja e util por construcao — isto vale sobretudo para
  // dias corridos.
  if (!temExpediente(entrada.calendario, fatal)) {
    const semExpediente = entrada.calendario.diaSemExpediente(fatal);
    if (semExpediente) registrar(semExpediente);
    const prorrogado = proximoComExpediente(entrada.calendario, fatal);
    premissas.push(
      `Vencimento prorrogado de ${formatarBR(fatal)} para ` +
        `${formatarBR(prorrogado)}: o ultimo dia nao teve expediente forense.`,
    );
    fatal = prorrogado;
  }

  premissas.push(
    config.diasUteis
      ? `Foram contados ${contados} dias uteis ate ${formatarBR(fatal)}.`
      : `Foram contados ${contados} dias corridos ate ${formatarBR(fatal)}.`,
  );

  return {
    dataFatal: fatal,
    dataPublicacaoConsiderada: publicacao,
    dataInicioContagem: inicio,
    diasUteisContados: contados,
    feriadosAplicados: [
      ...feriados.values(),
      ...(recessoAplicado ? [recessoAplicado] : []),
    ].sort((a, b) => a.data.localeCompare(b.data)),
    fundamentoLegal: config.fundamento,
    premissas,
    versaoMotor: VERSAO_MOTOR,
    calendarioIdentificacao: entrada.calendario.identificacao,
  };
}
