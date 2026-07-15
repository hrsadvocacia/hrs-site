/**
 * HRS Advocacia — Recebimento de leads do Simulador de Precatório/RPV.
 *
 * Google Apps Script vinculado a uma Planilha Google. Publicado como
 * "Aplicativo da Web" (Web App), recebe os POSTs do formulário do simulador
 * e grava uma linha na planilha. Sem custo e sem servidor próprio.
 *
 * >>> CONFIGURAÇÃO OBRIGATÓRIA: preencha SHEET_ID e (se quiser) ABA. <<<
 * Veja o README.md desta pasta para o passo a passo de publicação.
 *
 * Colunas gravadas (conforme escopo, seção 6):
 *   timestamp | nome | whatsapp | email | ente | natureza | valorBruto |
 *   classificacao | consentimentoLGPD | origem
 */

// ID da planilha (o trecho entre /d/ e /edit da URL da planilha).
const SHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';
// Nome da aba (guia) onde gravar. Deixe 'Leads'; a aba é criada se não existir.
const ABA = 'Leads';

const CABECALHO = [
  'timestamp', 'nome', 'whatsapp', 'email', 'ente', 'natureza',
  'valorBruto', 'classificacao', 'consentimentoLGPD', 'origem'
];

/** Health check: abrir a URL no navegador deve mostrar "ok". */
function doGet() {
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}

/** Recebe o lead do simulador. */
function doPost(e) {
  try {
    const dados = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Anti-bot: honeypot. Se o campo oculto veio preenchido, ignora silenciosamente.
    if (dados.website) return ok_();

    // Validação mínima (o cliente já valida; aqui é a segunda barreira).
    const nome = String(dados.nome || '').trim();
    const whatsapp = String(dados.whatsapp || '').trim();
    if (!nome || !whatsapp) return ok_(); // não trava o usuário; apenas não grava lixo
    if (dados.consentimentoLGPD !== true) return ok_();

    // Throttle simples por WhatsApp (Apps Script não expõe IP de forma confiável):
    // no máximo 1 gravação a cada 30s do mesmo número.
    const cache = CacheService.getScriptCache();
    const chave = 'lead_' + whatsapp.replace(/\D/g, '');
    if (cache.get(chave)) return ok_();
    cache.put(chave, '1', 30);

    const aba = getAba_();
    aba.appendRow([
      new Date(),
      nome,
      whatsapp,
      String(dados.email || '').trim(),
      String(dados.ente || ''),
      String(dados.natureza || ''),
      Number(dados.valorBruto || 0),
      String(dados.classificacao || ''),
      dados.consentimentoLGPD === true ? 'sim' : 'não',
      String(dados.origem || '')
    ]);

    return ok_();
  } catch (err) {
    // Nunca devolve erro ao cliente: o contato pelo WhatsApp não pode ser travado.
    console.error(err);
    return ok_();
  }
}

function getAba_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let aba = ss.getSheetByName(ABA);
  if (!aba) {
    aba = ss.insertSheet(ABA);
    aba.appendRow(CABECALHO);
  } else if (aba.getLastRow() === 0) {
    aba.appendRow(CABECALHO);
  }
  return aba;
}

function ok_() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
