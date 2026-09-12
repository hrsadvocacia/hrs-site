/**
 * Exportação iCalendar (RFC 5545) — para o advogado ver a agenda no celular.
 *
 * O arquivo carrega só o que a agenda do telefone precisa: título, local,
 * horário. Não carrega nome de cliente nem estratégia: calendário de celular
 * sincroniza com nuvem de terceiro que não é operador contratado.
 */
export interface EventoIcal {
  uid: string;
  titulo: string;
  inicio: Date;
  duracaoMinutos: number;
  local?: string;
  descricao?: string;
}

function escapar(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** RFC 5545 §3.1: linhas de no máximo 75 octetos, continuação com espaço. */
export function dobrarLinha(linha: string): string {
  const bytes = Buffer.from(linha, "utf8");
  if (bytes.length <= 75) return linha;
  const partes: string[] = [];
  let atual = "";
  let tamanho = 0;
  for (const ch of linha) {
    const n = Buffer.byteLength(ch, "utf8");
    const limite = partes.length === 0 ? 75 : 74;
    if (tamanho + n > limite) {
      partes.push(atual);
      atual = ch;
      tamanho = n;
    } else {
      atual += ch;
      tamanho += n;
    }
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

export function gerarIcal(eventos: readonly EventoIcal[], geradoEm: Date = new Date()): string {
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HRS Advocacia//Sistema Interno//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of eventos) {
    const fim = new Date(e.inicio.getTime() + e.duracaoMinutos * 60_000);
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@interno.hrsadvocacia.com.br`,
      `DTSTAMP:${utc(geradoEm)}`,
      `DTSTART:${utc(e.inicio)}`,
      `DTEND:${utc(fim)}`,
      `SUMMARY:${escapar(e.titulo)}`,
    );
    if (e.local) linhas.push(`LOCATION:${escapar(e.local)}`);
    if (e.descricao) linhas.push(`DESCRIPTION:${escapar(e.descricao)}`);
    linhas.push("END:VEVENT");
  }
  linhas.push("END:VCALENDAR");
  return linhas.map(dobrarLinha).join("\r\n") + "\r\n";
}
