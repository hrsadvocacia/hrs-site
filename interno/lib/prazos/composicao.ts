/**
 * Composição do calendário de um processo.
 *
 * O motor recebe o calendário pronto; é aqui que ele é montado. A regra de
 * composição está separada em `comporEntradas`, que é PURA e testável — o
 * acesso ao banco fica em `montarCalendarioDoProcesso`, uma casca fina em volta.
 *
 * Ordem de precedência (do mais específico para o mais geral):
 *   1. dia do calendário do tribunal restrito ao órgão julgador do processo;
 *   2. dia do calendário do tribunal válido para todo o tribunal;
 *   3. feriado municipal do MUNICÍPIO DO ÓRGÃO — não da sede do tribunal;
 *   4. feriado estadual da UF do órgão;
 *   5. feriado nacional.
 *
 * A precedência importa porque a fonte exibida ao advogado deve ser a mais
 * específica: "Portaria 3/2026 — TRT-18" explica melhor que "Lei 662/1949".
 */
import {
  type Calendario,
  type EntradaCalendario,
  criarCalendario,
} from "./calendario.ts";

export interface FeriadoGeralBruto {
  data: Date | string;
  nome: string;
  abrangencia: "NACIONAL" | "ESTADUAL" | "MUNICIPAL";
  uf: string | null;
  municipio: string | null;
  suspendeExpediente: boolean;
  fonte: string | null;
}

export interface DiaTribunalBruto {
  data: Date | string;
  descricao: string;
  suspendeExpediente: boolean;
  fonte: string;
  /** Nulo = alcança todo o tribunal. */
  orgaoJulgadorId: string | null;
}

export interface LocalDoProcesso {
  /** Município do órgão julgador. Determina os feriados municipais. */
  municipio: string | null;
  uf: string | null;
  orgaoJulgadorId: string | null;
}

function iso(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/** Comparação de nome de município tolerante a acento e caixa. */
function mesmoLugar(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();
  return normalizar(a) === normalizar(b);
}

/**
 * Regra pura de composição. Recebe tudo já carregado e devolve as entradas na
 * ordem de precedência, para `criarCalendario` (que mantém a primeira de cada
 * data) resolver os conflitos.
 */
export function comporEntradas(
  local: LocalDoProcesso,
  feriadosGerais: readonly FeriadoGeralBruto[],
  diasTribunal: readonly DiaTribunalBruto[],
): EntradaCalendario[] {
  const doOrgao: EntradaCalendario[] = [];
  const doTribunal: EntradaCalendario[] = [];

  for (const d of diasTribunal) {
    // Portaria restrita a OUTRO órgão não alcança este processo. Aplicar a
    // todo o tribunal uma suspensão que era de uma vara só ATRASA a data
    // fatal — o erro perigoso.
    if (d.orgaoJulgadorId && d.orgaoJulgadorId !== local.orgaoJulgadorId) {
      continue;
    }
    const entrada: EntradaCalendario = {
      data: iso(d.data),
      nome: d.descricao,
      origem: "TRIBUNAL",
      fonte: d.fonte,
      suspendeExpediente: d.suspendeExpediente,
    };
    if (d.orgaoJulgadorId) doOrgao.push(entrada);
    else doTribunal.push(entrada);
  }

  const municipais: EntradaCalendario[] = [];
  const estaduais: EntradaCalendario[] = [];
  const nacionais: EntradaCalendario[] = [];

  for (const f of feriadosGerais) {
    const entrada: EntradaCalendario = {
      data: iso(f.data),
      nome: f.nome,
      origem: f.abrangencia,
      fonte: f.fonte ?? "Origem não registrada",
      suspendeExpediente: f.suspendeExpediente,
    };
    if (f.abrangencia === "MUNICIPAL") {
      if (mesmoLugar(f.municipio, local.municipio)) municipais.push(entrada);
    } else if (f.abrangencia === "ESTADUAL") {
      if (f.uf && local.uf && f.uf.toUpperCase() === local.uf.toUpperCase()) {
        estaduais.push(entrada);
      }
    } else {
      nacionais.push(entrada);
    }
  }

  return [...doOrgao, ...doTribunal, ...municipais, ...estaduais, ...nacionais];
}

/** Identificação legível do calendário, gravada junto do prazo. */
export function identificarCalendario(
  codigoTribunal: string,
  ano: number,
  versao: number,
  municipio: string | null,
): string {
  const lugar = municipio ? `-${municipio.replace(/\s+/g, "")}` : "";
  return `${codigoTribunal}${lugar}-${ano}-v${versao}`;
}

export function montarCalendario(
  identificacao: string,
  local: LocalDoProcesso,
  feriadosGerais: readonly FeriadoGeralBruto[],
  diasTribunal: readonly DiaTribunalBruto[],
): Calendario {
  return criarCalendario(
    identificacao,
    comporEntradas(local, feriadosGerais, diasTribunal),
  );
}
