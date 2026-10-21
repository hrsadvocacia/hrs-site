/**
 * Feriados nacionais — funcoes puras, base do motor de prazos da Fase 1.
 *
 * Contem SOMENTE feriados de lei federal, que sao verificaveis. Feriados
 * estaduais e municipais, e sobretudo as suspensoes de expediente por portaria
 * de tribunal, NAO sao seedados por inferencia: entram pelo cadastro de
 * calendario, com a fonte registrada. Calendario errado perde prazo, e um
 * feriado inventado e pior do que um feriado ausente porque parece correto.
 */

export interface FeriadoNacional {
  /** ISO `AAAA-MM-DD`. */
  data: string;
  nome: string;
  fonte: string;
  movel: boolean;
}

/** Datas fixas de feriado civil nacional. */
const FIXOS: ReadonlyArray<{ mes: number; dia: number; nome: string; fonte: string }> = [
  { mes: 1, dia: 1, nome: "Confraternização Universal", fonte: "Lei 662/1949" },
  { mes: 4, dia: 21, nome: "Tiradentes", fonte: "Lei 662/1949" },
  { mes: 5, dia: 1, nome: "Dia do Trabalho", fonte: "Lei 662/1949" },
  { mes: 9, dia: 7, nome: "Independência do Brasil", fonte: "Lei 662/1949" },
  {
    mes: 10,
    dia: 12,
    nome: "Nossa Senhora Aparecida",
    fonte: "Lei 6.802/1980",
  },
  { mes: 11, dia: 2, nome: "Finados", fonte: "Lei 662/1949" },
  {
    mes: 11,
    dia: 15,
    nome: "Proclamação da República",
    fonte: "Lei 662/1949",
  },
  {
    mes: 11,
    dia: 20,
    nome: "Dia Nacional de Zumbi e da Consciência Negra",
    fonte: "Lei 14.759/2023",
  },
  { mes: 12, dia: 25, nome: "Natal", fonte: "Lei 662/1949" },
];

/** Primeiro ano em que a Consciencia Negra e feriado nacional. */
const ANO_CONSCIENCIA_NEGRA = 2024;

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Domingo de Pascoa pelo algoritmo gregoriano anonimo (Meeus/Jones/Butcher).
 * Base dos feriados moveis: Carnaval, Sexta-feira Santa e Corpus Christi.
 */
export function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data.getTime());
  nova.setUTCDate(nova.getUTCDate() + dias);
  return nova;
}

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Feriados moveis derivados da Pascoa.
 *
 * Observacao juridica: Carnaval e quarta-feira de cinzas nao sao feriados
 * civis por lei federal — sao ponto facultativo. Entram aqui porque os
 * tribunais os declaram sem expediente por portaria todos os anos, mas o
 * calendario do tribunal e que decide, e por isso `suspendeExpediente` e
 * decisao explicita no cadastro, nao consequencia automatica desta lista.
 */
export function feriadosMoveis(ano: number): FeriadoNacional[] {
  const pascoa = domingoDePascoa(ano);
  return [
    {
      data: paraIso(somarDias(pascoa, -48)),
      nome: "Carnaval (segunda-feira)",
      fonte: "Ponto facultativo — confirmar portaria do tribunal",
      movel: true,
    },
    {
      data: paraIso(somarDias(pascoa, -47)),
      nome: "Carnaval (terça-feira)",
      fonte: "Ponto facultativo — confirmar portaria do tribunal",
      movel: true,
    },
    {
      data: paraIso(somarDias(pascoa, -46)),
      nome: "Quarta-feira de Cinzas",
      fonte: "Ponto facultativo — confirmar portaria do tribunal",
      movel: true,
    },
    {
      data: paraIso(somarDias(pascoa, -2)),
      nome: "Sexta-feira Santa",
      fonte: "Feriado religioso de observância nacional",
      movel: true,
    },
    {
      data: paraIso(somarDias(pascoa, 60)),
      nome: "Corpus Christi",
      fonte: "Ponto facultativo — confirmar portaria do tribunal",
      movel: true,
    },
  ];
}

/** Feriados fixos de lei federal para o ano. */
export function feriadosFixos(ano: number): FeriadoNacional[] {
  return FIXOS.filter(
    (f) =>
      !(f.mes === 11 && f.dia === 20 && ano < ANO_CONSCIENCIA_NEGRA),
  ).map((f) => ({
    data: iso(ano, f.mes, f.dia),
    nome: f.nome,
    fonte: f.fonte,
    movel: false,
  }));
}

export function feriadosNacionais(ano: number): FeriadoNacional[] {
  return [...feriadosFixos(ano), ...feriadosMoveis(ano)].sort((a, b) =>
    a.data.localeCompare(b.data),
  );
}
