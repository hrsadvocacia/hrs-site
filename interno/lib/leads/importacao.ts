/**
 * Importação de leads dos simuladores (planilha Google Sheets exportada em CSV).
 *
 * Prov. 205/2021 CFOAB: o lead só pode entrar na fila de contato humano se
 * ELE pediu contato, e o consentimento precisa ter data e origem. Linha sem
 * consentimento datado não é recusada — é importada como SEM_CONSENTIMENTO,
 * para que a base reflita a realidade — mas nunca aparece na fila de contato,
 * e o banco recusa marcar `solicitouContato` sem `consentimentoEm` (CHECK
 * `lead_consentimento_datado`).
 *
 * Não há disparo proativo: importar não envia nada a ninguém.
 */

export type Simulador = "PRECATORIO_RPV" | "VERBAS_RESCISORIAS" | "OUTRO";

export interface LeadImportado {
  linha: number;
  nome: string;
  whatsapp: string;
  email: string | null;
  simulador: Simulador;
  solicitouContato: boolean;
  consentimentoEm: Date | null;
  /** Demais colunas da planilha, como vieram (resultado do simulador etc.). */
  payload: Record<string, string>;
  /** Origem registrada com o consentimento, para atender pedido do titular. */
  origem: string;
  erros: string[];
}

/** Dias até descarte de lead não convertido (retenção mínima necessária). */
export const RETENCAO_LEAD_DIAS = 180;

/** Parser de CSV: aceita ";" ou ",", aspas duplas, CRLF e BOM. */
export function analisarCsv(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, "");
  const primeiraLinha = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeiraLinha.match(/;/g)?.length ?? 0) >= (primeiraLinha.match(/,/g)?.length ?? 0) ? ";" : ",";

  const linhas: string[][] = [];
  let atual: string[] = [];
  let campo = "";
  let entreAspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]!;
    if (entreAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; }
        else entreAspas = false;
      } else campo += c;
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === sep) {
      atual.push(campo); campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      atual.push(campo); campo = "";
      if (atual.some((x) => x.trim() !== "")) linhas.push(atual);
      atual = [];
    } else campo += c;
  }
  atual.push(campo);
  if (atual.some((x) => x.trim() !== "")) linhas.push(atual);
  return linhas;
}

function chave(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const SINONIMOS: Record<string, string[]> = {
  nome: ["nome", "nome completo", "name"],
  whatsapp: ["whatsapp", "telefone", "celular", "fone", "phone", "contato"],
  email: ["email", "e mail", "correio eletronico"],
  simulador: ["simulador", "origem", "calculadora", "ferramenta", "tipo"],
  solicitouContato: ["solicitou contato", "deseja contato", "quer contato", "aceito contato", "autorizo contato", "contato", "consentimento", "aceite", "autorizacao"],
  consentimentoEm: ["data consentimento", "data do consentimento", "consentimento em", "carimbo de data hora", "timestamp", "data", "data hora", "enviado em"],
  origem: ["pagina", "url", "fonte", "utm source", "origem utm"],
};

/** Mapeia cabeçalhos da planilha para os campos do lead, tolerando variação. */
export function mapearCabecalho(cabecalho: readonly string[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  const normalizados = cabecalho.map(chave);
  for (const [campo, nomes] of Object.entries(SINONIMOS)) {
    for (const nome of nomes) {
      const idx = normalizados.findIndex((h) => h === nome);
      if (idx >= 0 && !(campo in mapa) && !Object.values(mapa).includes(idx)) {
        mapa[campo] = idx;
        break;
      }
    }
  }
  return mapa;
}

const SIM = new Set(["sim", "s", "yes", "y", "true", "1", "aceito", "autorizo", "quero", "concordo", "x"]);

export function interpretarBooleano(texto: string): boolean {
  return SIM.has(chave(texto));
}

/** dd/mm/aaaa [hh:mm[:ss]], aaaa-mm-dd[Thh:mm], ou ISO. Devolve null se não entender. */
export function interpretarData(texto: string): Date | null {
  const t = texto.trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const d = new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!, +(m[4] ?? 0) + 3, +(m[5] ?? 0), +(m[6] ?? 0)));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const d = new Date(t.length === 10 ? `${t}T00:00:00Z` : t.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function interpretarSimulador(texto: string): Simulador {
  const k = chave(texto);
  if (/precat|rpv/.test(k)) return "PRECATORIO_RPV";
  if (/rescis|verba|trabalh|clt/.test(k)) return "VERBAS_RESCISORIAS";
  return "OUTRO";
}

export function somenteDigitosTelefone(texto: string): string {
  const d = texto.replace(/\D/g, "");
  return d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
}

/** Converte a planilha inteira. Linhas com erro vêm marcadas, não descartadas. */
export function importarLeads(csv: string, origemPadrao: string): LeadImportado[] {
  const linhas = analisarCsv(csv);
  if (linhas.length < 2) return [];
  const cabecalho = linhas[0]!;
  const mapa = mapearCabecalho(cabecalho);
  const resultado: LeadImportado[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i]!;
    const col = (campo: string) => (campo in mapa ? (l[mapa[campo]!] ?? "").trim() : "");
    const erros: string[] = [];

    const nome = col("nome");
    const whatsapp = somenteDigitosTelefone(col("whatsapp"));
    const email = col("email") || null;
    if (!nome) erros.push("Nome ausente.");
    if (whatsapp.length < 10 || whatsapp.length > 11) erros.push("WhatsApp inválido (DDD + número).");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push("E-mail inválido.");

    const solicitou = interpretarBooleano(col("solicitouContato"));
    const consentimentoEm = interpretarData(col("consentimentoEm"));
    if (solicitou && !consentimentoEm) {
      erros.push("Pediu contato, mas a planilha não traz data do consentimento — não pode entrar na fila sem ela.");
    }

    const payload: Record<string, string> = {};
    cabecalho.forEach((h, idx) => {
      if (!Object.values(mapa).includes(idx) && (l[idx] ?? "").trim() !== "") payload[h.trim()] = (l[idx] ?? "").trim();
    });

    resultado.push({
      linha: i + 1,
      nome,
      whatsapp,
      email,
      simulador: interpretarSimulador(col("simulador")),
      solicitouContato: solicitou && consentimentoEm !== null,
      consentimentoEm: solicitou ? consentimentoEm : null,
      payload,
      origem: col("origem") || origemPadrao,
      erros,
    });
  }
  return resultado;
}
