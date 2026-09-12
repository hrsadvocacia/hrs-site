/**
 * Validação de conformidade de textos destinados ao cliente.
 *
 * Provimento 205/2021 do CFOAB e Código de Ética (arts. 39 a 47): é vedado ao
 * advogado prometer resultado, anunciar valor a receber ou garantir prazo de
 * conclusão. O escritório traduziu isso em regra de produto: NENHUM template,
 * tela ou relatório destinado ao cliente pode conter promessa de resultado,
 * valor certo ou prazo garantido — e a regra é aplicada por código, com teste.
 *
 * A validação é propositalmente CONSERVADORA: prefere recusar uma frase
 * inocente (que o advogado reescreve em dez segundos) a deixar passar uma
 * frase que gera processo ético. O resultado lista cada trecho e o motivo,
 * para que a correção seja informada e não adivinhada.
 *
 * Comparação sem acento e sem caixa: "Garantimos o ÊXITO" e "garantimos o
 * exito" são a mesma promessa.
 */

export type TipoVedacao =
  | "PROMESSA_RESULTADO"
  | "VALOR_CERTO"
  | "PRAZO_GARANTIDO"
  | "CAPTACAO_INDEVIDA";

export interface Violacao {
  tipo: TipoVedacao;
  trecho: string;
  explicacao: string;
}

export const EXPLICACAO: Record<TipoVedacao, string> = {
  PROMESSA_RESULTADO:
    "Promessa ou anúncio de resultado provável (Prov. 205/2021, art. 3º; CED art. 39 e 42, VI).",
  VALOR_CERTO:
    "Estimativa ou afirmação de valor a receber. O valor de honorário devido por parcela é variável do template, nunca texto fixo.",
  PRAZO_GARANTIDO:
    "Prazo de conclusão ou de recebimento apresentado como garantido ou previsto.",
  CAPTACAO_INDEVIDA:
    "Linguagem promocional, comparativa ou de captação de clientela (Prov. 205/2021, art. 4º).",
};

/** Minúsculas, sem acento, espaços colapsados. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NUM = String.raw`(?:\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|poucos|poucas|alguns|algumas|breves?)`;
const UNIDADE_TEMPO = String.raw`(?:dias?|semanas?|mes|meses|anos?|horas?)`;
const CONCLUSAO = String.raw`(?:conclui|resolvi|julga|encerra|finaliza|libera|pag|deferi|termina|sai|recebe|senten|decidi|transit)\w*`;

/**
 * Regras marcadas com `admiteNegacao` deixam passar a frase quando ela NEGA a
 * previsão ("não há previsão de julgamento", "sem estimativa de valor") — que é
 * justamente a frase correta a dizer ao cliente. A exceção é estreita: só vale
 * para "previsão/estimativa", nunca para promessa de resultado.
 */
const REGRAS: ReadonlyArray<{ tipo: TipoVedacao; padrao: RegExp; admiteNegacao?: boolean }> = [
  // ---- Promessa de resultado ------------------------------------------------
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:garant\w*)\b[^.!?\n]{0,60}\b(?:exito|vitoria|ganho|resultado|causa|sucesso|procedencia|condenacao|beneficio|aposentadoria|direito|reconhecimento|indenizacao|acordo)\b/ },
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:exito|vitoria|ganho|resultado|sucesso|procedencia|beneficio|aposentadoria|direito|deferimento)\b[^.!?\n]{0,30}\b(?:garantid[oa]s?|assegurad[oa]s?|certos?|certa|certeza)\b/ },
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:vai|ira|irao|vao|vamos|iremos|voce vai|voces vao|o senhor vai|a senhora vai)\s+(?:ganhar|vencer)\b/ },
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:ganho de causa|causa ganha|sucesso garantido|vitoria certa|resultado certo|resultado provavel|resultado esperado|desfecho favoravel|resultado favoravel|decisao favoravel garantida)\b/ },
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:com certeza|certamente|sem duvida|sem sombra de duvida|garantidamente|e certo que|tenho certeza|temos certeza|tenho convicção|temos convicção|tenho conviccao|temos conviccao)\b[^.!?\n]{0,80}\b(?:ganh|venc|exito|procedent|deferi|reconhec|receb|condena|favora)\w*/ },
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:grandes?|altas?|otimas?|excelentes?|boas?|enormes?|\d+\s*%(?: de)?)\s+chances?\b/ },
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:chances?|probabilidade|possibilidade)\s+(?:de\s+)?(?:exito|vitoria|ganhar|vencer|sucesso|procedencia)\b/ },
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:provavelmente|muito provavel|e provavel|tudo indica)\b[^.!?\n]{0,60}\b(?:ganh|venc|exito|procedent|deferi|favora|receb|condena)\w*/ },
  { tipo: "PROMESSA_RESULTADO", padrao: /\b(?:vai|ira|deve|devera|havera de)\s+(?:ser\s+)?(?:procedente|deferid[oa]|condenad[oa]|reconhecid[oa]|julgad[oa] procedente)\b/ },

  // ---- Valor certo ------------------------------------------------------------
  { tipo: "VALOR_CERTO", padrao: /\br\$\s*\d/ },
  { tipo: "VALOR_CERTO", padrao: /\b\d[\d.]*,\d{2}\s*(?:reais|mil reais)\b/ },
  { tipo: "VALOR_CERTO", padrao: /\b\d+\s*(?:mil|milhoes?|milhao)\s*(?:reais|de reais)\b/ },
  { tipo: "VALOR_CERTO", padrao: /\b(?:voce|voces|o senhor|a senhora|vc|o cliente|a cliente)\s+(?:vai|ira|deve|devera|podera|pode)\s+receber\b/ },
  { tipo: "VALOR_CERTO", padrao: /\b(?:valor|quantia|montante|indenizacao|beneficio|verba|credito)\s+(?:estimad[oa]|provavel|aproximad[oa]|esperad[oa]|previst[oa]|garantid[oa]|certo|certa)\b/ },
  { tipo: "VALOR_CERTO", padrao: /\b(?:estimativa|estimamos|estima-se|previsao|projecao|projetamos|calculamos)\s+(?:de\s+|do\s+|da\s+)?(?:valor|recebimento|indenizacao|quantia|montante|verba|credito|beneficio)/, admiteNegacao: true },
  { tipo: "VALOR_CERTO", padrao: /\b(?:aproximadamente|cerca de|em torno de|por volta de|no minimo|pelo menos|ate|mais de|acima de)\s+(?:r\$|\d[\d.]*\s*(?:mil|reais))/ },
  { tipo: "VALOR_CERTO", padrao: /\b(?:recebera|receberao|vai receber|ira receber)\s+(?:r\$|\d|um valor|uma quantia|o valor|a quantia)/ },

  // ---- Prazo garantido --------------------------------------------------------
  { tipo: "PRAZO_GARANTIDO", padrao: /\bprazo\s+(?:garantido|certo|maximo garantido|assegurado)\b/ },
  { tipo: "PRAZO_GARANTIDO", padrao: /\bgarant\w*\s+(?:o\s+|a\s+)?(?:prazo|entrega|conclusao|data|rapidez|agilidade)\b/ },
  { tipo: "PRAZO_GARANTIDO", padrao: new RegExp(String.raw`\b(?:sera|serao|vai ser|vao ser|deve ser|devera ser|estara|estarao|ficara|ficarao)\s+${CONCLUSAO}\s+(?:em|ate|dentro de|no maximo em|no prazo de|antes de)\s+${NUM}\s*${UNIDADE_TEMPO}`) },
  { tipo: "PRAZO_GARANTIDO", padrao: new RegExp(String.raw`\b(?:processo|causa|acao|caso|beneficio|aposentadoria|pagamento|alvara|rpv|precatorio|indenizacao|sentenca|decisao|julgamento|recurso)\b[^.!?\n]{0,50}\b(?:em|ate|dentro de|no maximo em|no prazo de|antes de|em menos de)\s+${NUM}\s*${UNIDADE_TEMPO}\b`) },
  { tipo: "PRAZO_GARANTIDO", padrao: new RegExp(String.raw`\b(?:sai|saira|resolve|resolvemos|resolveremos|conclui|concluimos|concluiremos|termina|terminamos|liberamos|liberaremos|recebe|recebera)\s+(?:tudo\s+)?(?:em|ate|dentro de|no maximo em|em menos de)\s+${NUM}\s*${UNIDADE_TEMPO}\b`) },
  { tipo: "PRAZO_GARANTIDO", padrao: /\b(?:previsao|estimativa|expectativa)\s+(?:de\s+)?(?:conclusao|termino|encerramento|julgamento|sentenca|recebimento|pagamento|liberacao|prazo)\b/, admiteNegacao: true },
  { tipo: "PRAZO_GARANTIDO", padrao: /\b(?:conclusao|termino|encerramento|julgamento|recebimento|pagamento|liberacao)\s+(?:previst[oa]s?|estimad[oa]s?|garantid[oa]s?|assegurad[oa]s?)\b/, admiteNegacao: true },

  // ---- Captação indevida / publicidade vedada ---------------------------------
  { tipo: "CAPTACAO_INDEVIDA", padrao: /\b(?:promocao|promocional|desconto|oferta|ofertas|gratis|gratuito|gratuita|de graca|brinde|sorteio|cupom|black friday)\b/ },
  { tipo: "CAPTACAO_INDEVIDA", padrao: /\bindique\s+(?:um|uma|seus?|suas?|amigos?|parentes?|e ganhe)\b/ },
  { tipo: "CAPTACAO_INDEVIDA", padrao: /\b(?:o|a|os|as)\s+(?:melhor|melhores|maior|maiores|mais experiente|mais experientes|numero 1|n[º°o] 1|lider|lideres)\s+(?:escritorio|advogad[oa]s?|equipe|banca)\b/ },
  { tipo: "CAPTACAO_INDEVIDA", padrao: /\b(?:especialistas? em|referencia em|primeiro lugar|premiad[oa]s?|top \d+)\b/ },
  { tipo: "CAPTACAO_INDEVIDA", padrao: /\b(?:nao perca|ultima chance|aproveite|por tempo limitado|vagas limitadas|corra|so hoje|somente hoje)\b/ },
];

/**
 * Valida um texto destinado ao cliente. Devolve lista vazia quando está em
 * conformidade. Cada violação traz o trecho encontrado no texto ORIGINAL
 * (com acentos, na posição real) para que a tela destaque exatamente o que
 * precisa mudar.
 */
export function validarTexto(texto: string): Violacao[] {
  const normalizado = normalizar(texto);
  const violacoes: Violacao[] = [];
  const vistos = new Set<string>();

  for (const regra of REGRAS) {
    const global = new RegExp(regra.padrao.source, "g");
    let m: RegExpExecArray | null;
    while ((m = global.exec(normalizado)) !== null) {
      if (regra.admiteNegacao && negadoAntes(normalizado, m.index)) {
        continue;
      }
      const trecho = m[0].trim();
      const chave = `${regra.tipo}:${trecho}`;
      if (!vistos.has(chave)) {
        vistos.add(chave);
        violacoes.push({ tipo: regra.tipo, trecho, explicacao: EXPLICACAO[regra.tipo] });
      }
      if (m[0].length === 0) global.lastIndex++;
    }
  }
  return violacoes;
}

const NEGACAO_ANTES = /(?:\bnao\b[^.!?\n]{0,20}|\bsem\s+(?:qualquer\s+|nenhuma?\s+)?|\bnenhuma?\s+)$/;

function negadoAntes(texto: string, indice: number): boolean {
  return NEGACAO_ANTES.test(texto.slice(Math.max(0, indice - 30), indice));
}

export function emConformidade(texto: string): boolean {
  return validarTexto(texto).length === 0;
}

/** Erro lançado quando um texto vedado tenta ser gravado ou exibido. */
export class TextoVedadoError extends Error {
  readonly violacoes: readonly Violacao[];
  constructor(violacoes: readonly Violacao[]) {
    super(
      "Texto destinado ao cliente contém conteúdo vedado: " +
        violacoes.map((v) => `"${v.trecho}" (${v.tipo})`).join("; "),
    );
    this.name = "TextoVedadoError";
    this.violacoes = violacoes;
  }
}

export function exigirConformidade(texto: string): void {
  const v = validarTexto(texto);
  if (v.length > 0) throw new TextoVedadoError(v);
}
