/**
 * Validação de arquivo enviado: tipo pelos BYTES, não pela extensão nem pelo
 * Content-Type declarado pelo navegador (ambos são escolhidos por quem envia).
 *
 * Antivírus: não há verificador contratado. O status fica PENDENTE e a tela
 * diz isso — marcar LIMPO sem verificar seria mentir para quem abre o arquivo.
 */
export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024;

export interface TipoPermitido {
  mime: string;
  extensoes: readonly string[];
  rotulo: string;
}

export const TIPOS_PERMITIDOS: readonly TipoPermitido[] = [
  { mime: "application/pdf", extensoes: ["pdf"], rotulo: "PDF" },
  { mime: "image/jpeg", extensoes: ["jpg", "jpeg"], rotulo: "Imagem JPEG" },
  { mime: "image/png", extensoes: ["png"], rotulo: "Imagem PNG" },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensoes: ["docx"], rotulo: "Word (.docx)" },
];

function comeca(bytes: Uint8Array, assinatura: number[], offset = 0): boolean {
  return assinatura.every((b, i) => bytes[offset + i] === b);
}

/** Detecta o tipo pela assinatura. Devolve null quando não reconhece. */
export function detectarTipo(bytes: Uint8Array, nomeArquivo: string): TipoPermitido | null {
  const ext = nomeArquivo.toLowerCase().split(".").pop() ?? "";
  if (comeca(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return TIPOS_PERMITIDOS[0]!; // %PDF-
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return TIPOS_PERMITIDOS[1]!;
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return TIPOS_PERMITIDOS[2]!;
  // DOCX é um ZIP (PK\x03\x04). Só aceitamos ZIP quando a extensão diz docx e
  // o pacote traz o [Content_Types].xml no início — o mínimo para não aceitar
  // um .zip qualquer renomeado.
  if (comeca(bytes, [0x50, 0x4b, 0x03, 0x04]) && ext === "docx") {
    const cabeca = Buffer.from(bytes.slice(0, 4096)).toString("latin1");
    if (cabeca.includes("[Content_Types].xml") || cabeca.includes("word/")) return TIPOS_PERMITIDOS[3]!;
  }
  return null;
}

export interface ResultadoValidacao {
  ok: boolean;
  tipo: TipoPermitido | null;
  erro?: string;
}

export function validarArquivo(bytes: Uint8Array, nomeArquivo: string): ResultadoValidacao {
  if (bytes.length === 0) return { ok: false, tipo: null, erro: "Arquivo vazio." };
  if (bytes.length > TAMANHO_MAXIMO_BYTES) {
    return { ok: false, tipo: null, erro: `Arquivo maior que ${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB.` };
  }
  const tipo = detectarTipo(bytes, nomeArquivo);
  if (!tipo) {
    return {
      ok: false,
      tipo: null,
      erro: "Tipo não permitido. Aceitos: " + TIPOS_PERMITIDOS.map((t) => t.rotulo).join(", ") + ".",
    };
  }
  const ext = nomeArquivo.toLowerCase().split(".").pop() ?? "";
  if (!tipo.extensoes.includes(ext)) {
    return { ok: false, tipo, erro: `O conteúdo é ${tipo.rotulo}, mas a extensão é ".${ext}". Renomeie o arquivo.` };
  }
  return { ok: true, tipo };
}

/** Nome seguro para exibição e download: sem caminho, sem controle, tamanho limitado. */
export function nomeSeguro(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "arquivo";
  return base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_").slice(0, 180) || "arquivo";
}
