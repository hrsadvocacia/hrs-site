/**
 * CSV para Excel em português.
 *
 * Separador ";" (o Excel pt-BR usa vírgula como decimal e não abre CSV com
 * vírgula corretamente), BOM UTF-8 para acentos, CRLF, e escape por aspas
 * duplas. Células que começam com =, +, -, @ recebem apóstrofo: sem isso, uma
 * célula "=HYPERLINK(...)" vinda de dado de cliente vira fórmula executável
 * na planilha de quem abriu o relatório (CSV injection).
 */
export function gerarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const escapar = (v: string | number | null | undefined): string => {
    let texto = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    if (/[";\r\n]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;
    return texto;
  };
  const corpo = [cabecalho, ...linhas].map((l) => l.map(escapar).join(";")).join("\r\n");
  return `﻿${corpo}\r\n`;
}
