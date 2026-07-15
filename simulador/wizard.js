// @ts-check
/**
 * Controlador da interface do Simulador (equivalente ao 'use client').
 * Carrega os parâmetros, conduz o wizard de 4 passos, chama o motor puro
 * (engine.js) e renderiza o resultado + captura de lead.
 *
 * @module simulador/wizard
 */
import { simular, ParametroPendenteError, EntradaInvalidaError } from './engine.js';

/** @typedef {import('./tipos.js').Parametros} Parametros */

// ─── Configuração ───────────────────────────────────────────────────────────
// Endpoint de gravação de lead. Deixe '' até definir o mecanismo (ex.: URL de
// um Google Apps Script Web App vinculado à planilha). Enquanto vazio, o lead
// NÃO é enviado por rede — o contato acontece só pelo WhatsApp iniciado pelo
// usuário (modelo passivo, conforme Provimento 205/2021).
const LEAD_ENDPOINT = '';
// Número de WhatsApp para o contato iniciado pelo usuário (unidade principal).
const WHATSAPP = '5586999854705';

const DISCLAIMER =
  'Esta é uma ferramenta informativa e gratuita. O resultado é uma <strong>estimativa</strong> ' +
  'baseada nas informações fornecidas e nos parâmetros legais vigentes, e <strong>não constitui ' +
  'consulta, parecer ou promessa de resultado</strong>. Valores, índices de atualização, tributação ' +
  'e prazos variam conforme o caso concreto, o ente devedor e a natureza da verba. Somente a análise ' +
  'dos autos por advogado permite conclusão segura.';

const PASSOS = [
  'Quem é o devedor?',
  'Qual a natureza e o valor?',
  'Situação atual',
  'Resultado',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** @param {number} n */
const fmtBRL = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** Máscara de moeda: mantém só dígitos, interpreta como centavos. @param {HTMLInputElement} el */
function aplicarMascaraMoeda(el) {
  const digitos = el.value.replace(/\D/g, '');
  if (!digitos) { el.value = ''; return; }
  const centavos = parseInt(digitos, 10);
  el.value = fmtBRL(centavos / 100);
}
/** @param {HTMLInputElement} el @returns {number} */
function valorNumerico(el) {
  const digitos = el.value.replace(/\D/g, '');
  return digitos ? parseInt(digitos, 10) / 100 : 0;
}

/** Lê parâmetros de UTM/origem da URL. @returns {string} */
function origemUTM() {
  const p = new URLSearchParams(location.search);
  const campos = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const partes = campos.map((c) => p.get(c)).filter(Boolean);
  return partes.length ? partes.join(' | ') : (document.referrer || 'direto');
}

// ─── Estado ──────────────────────────────────────────────────────────────────
let passo = 1;
/** @type {Parametros | null} */
let PARAMS = null;

// ─── Inicialização ───────────────────────────────────────────────────────────
async function init() {
  const form = $('simForm');
  if (!form) return;
  try {
    const resp = await fetch('data/parametros.json', { cache: 'no-store' });
    PARAMS = await resp.json();
  } catch {
    PARAMS = null;
  }
  popularEntes();
  ligarEventos();
  irParaPasso(1);
}

function popularEntes() {
  const sel = /** @type {HTMLSelectElement} */ ($('f-ente'));
  if (!sel || !PARAMS) return;
  for (const ente of PARAMS.entes) {
    const opt = document.createElement('option');
    opt.value = ente.id;
    opt.textContent = ente.nome;
    sel.appendChild(opt);
  }
}

function ligarEventos() {
  $('btnNext').addEventListener('click', () => { if (validarPasso(passo)) irParaPasso(passo + 1); });
  $('btnBack').addEventListener('click', () => irParaPasso(passo - 1));
  $('simForm').addEventListener('submit', (e) => { e.preventDefault(); if (validarPasso(3)) calcular(); });

  const valor = /** @type {HTMLInputElement} */ ($('f-valor'));
  valor.addEventListener('input', () => aplicarMascaraMoeda(valor));

  // Mostra/oculta data de expedição
  document.querySelectorAll('input[name="expedido"]').forEach((r) =>
    r.addEventListener('change', () => {
      const sim = /** @type {HTMLInputElement} */ (document.querySelector('input[name="expedido"]:checked')).value === 'sim';
      $('wrap-dataExpedicao').hidden = !sim;
    })
  );
}

// ─── Navegação ───────────────────────────────────────────────────────────────
/** @param {number} n */
function irParaPasso(n) {
  passo = Math.min(3, Math.max(1, n));
  for (let i = 1; i <= 3; i++) $('step' + i).hidden = i !== passo;
  // progresso
  const lis = document.querySelectorAll('#simProgress li');
  lis.forEach((li, i) => {
    li.className = i < passo - 1 ? 'done' : i === passo - 1 ? 'current' : '';
  });
  $('simStepLabel').innerHTML = `Passo ${passo} de 4 &middot; ${PASSOS[passo - 1]}`;
  $('btnBack').hidden = passo === 1;
  $('btnNext').hidden = passo === 3;
  $('btnCalc').hidden = passo !== 3;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** @param {string} id @param {boolean} mostrar */
function erro(id, mostrar) { $(id).hidden = !mostrar; }

/** @param {number} n @returns {boolean} */
function validarPasso(n) {
  if (n === 1) {
    const ok = !!(/** @type {HTMLSelectElement} */ ($('f-ente')).value);
    erro('err-ente', !ok);
    return ok;
  }
  if (n === 2) {
    const nat = document.querySelector('input[name="natureza"]:checked');
    const valor = valorNumerico(/** @type {HTMLInputElement} */ ($('f-valor')));
    const dataBase = /** @type {HTMLInputElement} */ ($('f-dataBase')).value;
    const hojeISO = new Date().toISOString().slice(0, 10);
    erro('err-natureza', !nat);
    erro('err-valor', !(valor > 0));
    erro('err-dataBase', !(dataBase && dataBase <= hojeISO));
    return !!nat && valor > 0 && !!dataBase && dataBase <= hojeISO;
  }
  if (n === 3) {
    const expedido = /** @type {HTMLInputElement} */ (document.querySelector('input[name="expedido"]:checked')).value === 'sim';
    const hojeISO = new Date().toISOString().slice(0, 10);
    let ok = true;
    if (expedido) {
      const d = /** @type {HTMLInputElement} */ ($('f-dataExpedicao')).value;
      ok = !!d && d <= hojeISO;
      erro('err-dataExpedicao', !ok);
    }
    const pctEl = /** @type {HTMLInputElement} */ ($('f-honorarios'));
    const pct = pctEl.value ? Number(pctEl.value) : 0;
    const pctOk = pct >= 0 && pct <= 100;
    erro('err-honorarios', !pctOk);
    return ok && pctOk;
  }
  return true;
}

// ─── Cálculo + render ────────────────────────────────────────────────────────
function calcular() {
  if (!PARAMS) return;
  const expedido = /** @type {HTMLInputElement} */ (document.querySelector('input[name="expedido"]:checked')).value === 'sim';
  const pctEl = /** @type {HTMLInputElement} */ ($('f-honorarios'));

  /** @type {import('./tipos.js').EntradaSimulacao} */
  const entrada = {
    ente: /** @type {HTMLSelectElement} */ ($('f-ente')).value,
    naturezaCredito: /** @type {any} */ (/** @type {HTMLInputElement} */ (document.querySelector('input[name="natureza"]:checked')).value),
    valorBruto: valorNumerico(/** @type {HTMLInputElement} */ ($('f-valor'))),
    dataBaseValor: /** @type {HTMLInputElement} */ ($('f-dataBase')).value,
    temPreferencia: /** @type {HTMLInputElement} */ (document.querySelector('input[name="preferencia"]:checked')).value === 'sim',
    jaExpedido: expedido,
    dataExpedicao: expedido ? /** @type {HTMLInputElement} */ ($('f-dataExpedicao')).value : undefined,
    honorariosContratuaisPct: pctEl.value ? Number(pctEl.value) : 0,
    destacarHonorarios: /** @type {HTMLInputElement} */ ($('f-destacar')).checked,
  };

  const alvo = $('simResult');
  try {
    const r = simular(entrada, PARAMS);
    alvo.innerHTML = renderResultado(r, entrada);
    ligarLead(entrada, r);
  } catch (e) {
    if (e instanceof ParametroPendenteError) {
      alvo.innerHTML = renderEmConfiguracao();
    } else if (e instanceof EntradaInvalidaError) {
      alvo.innerHTML = `<div class="sim-config"><h2>Revise os dados</h2><p>${e.message}</p></div>`;
    } else {
      alvo.innerHTML = `<div class="sim-config"><h2>Não foi possível calcular</h2><p>Tente novamente ou fale com o escritório.</p></div>`;
    }
  }
  alvo.hidden = false;
  $('simStepLabel').innerHTML = 'Passo 4 de 4 &middot; Resultado';
  document.querySelectorAll('#simProgress li').forEach((li) => (li.className = 'done'));
  alvo.focus();
  alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * @param {import('./tipos.js').ResultadoSimulacao} r
 * @param {import('./tipos.js').EntradaSimulacao} entrada
 */
function renderResultado(r, entrada) {
  const isRPV = r.classificacao === 'RPV';
  const rotulo = isRPV ? 'RPV — Requisição de Pequeno Valor' : 'Precatório';

  const renuncia = r.cenarioRenuncia
    ? `<div class="res-card res-renuncia">
        <h3>Existe uma escolha a considerar</h3>
        <div class="res-tradeoff-nums">
          <div class="res-tradeoff-num"><span class="n">${fmtBRL(r.cenarioRenuncia.perdaEmReais)}</span><span class="l">valor de que se abre mão</span></div>
          <div class="res-tradeoff-num"><span class="n">~${r.cenarioRenuncia.ganhoEmTempoMeses} meses</span><span class="l">a menos de espera (estimativa)</span></div>
          <div class="res-tradeoff-num"><span class="n">${fmtBRL(r.cenarioRenuncia.valorAposRenuncia)}</span><span class="l">recebido como RPV</span></div>
        </div>
        <p>${r.cenarioRenuncia.textoTradeoff}</p>
      </div>` : '';

  const descLinhas = [];
  if (r.descontosEstimados.honorariosContratuais != null) {
    const destac = entrada.destacarHonorarios;
    descLinhas.push(`<div class="res-linha"><span>Honorários contratuais${destac ? ' (destacados na origem)' : ''}</span><span class="val">${destac ? '—' : '−'} ${fmtBRL(r.descontosEstimados.honorariosContratuais)}</span></div>`);
  }
  const descontos = `<div class="res-card">
      <h3>Descontos estimados e valor líquido</h3>
      <div class="res-linha"><span>Valor de referência</span><span class="val">${fmtBRL(r.valorAtualizadoEstimado)}</span></div>
      ${descLinhas.join('')}
      <div class="res-liquido"><span class="lbl">Líquido estimado</span><span class="val">${fmtBRL(r.liquidoEstimado)}</span></div>
      <p style="margin-top:12px;font-size:12.5px;color:#7d90ad;">${r.descontosEstimados.observacao}</p>
    </div>`;

  const alertas = r.alertas.length
    ? `<div class="res-card"><h3>Pontos de atenção</h3><ul class="res-alertas">${r.alertas.map((a) => `<li>${a}</li>`).join('')}</ul></div>`
    : '';

  const premissas = `<details class="res-card res-premissas">
      <summary>Premissas usadas neste cálculo</summary>
      <ol>${r.premissas.map((p) => `<li>${p}</li>`).join('')}</ol>
    </details>`;

  return `
    <div class="res-verdict ${isRPV ? 'is-rpv' : 'is-precatorio'}">
      <p class="res-tag">Classificação estimada</p>
      <p class="res-class">${r.classificacao}</p>
      <p class="res-valor">${rotulo} &middot; valor de referência ${fmtBRL(r.valorAtualizadoEstimado)}</p>
    </div>

    <div class="res-card">
      <h3>Prazo estimado de recebimento</h3>
      <p class="res-prazo-faixa">${r.faixaPrazo.minMeses} a ${r.faixaPrazo.maxMeses} meses</p>
      <p>${r.faixaPrazo.textoExplicativo}</p>
    </div>

    ${renuncia}
    ${descontos}
    ${alertas}
    ${premissas}

    <div class="sim-disclaimer">${DISCLAIMER}</div>

    ${renderLead()}
  `;
}

function renderLead() {
  return `
    <div class="lead-block" id="leadBlock">
      <h2>Quer a análise do seu caso concreto?</h2>
      <p class="lead-sub">Se preferir, deixe seu contato e fale com um advogado do escritório. O contato pelo WhatsApp é iniciado por você — não enviamos mensagens automáticas.</p>
      <form id="leadForm" novalidate>
        <div class="sim-field"><label for="l-nome">Nome</label><input type="text" id="l-nome" name="nome" autocomplete="name" required /></div>
        <div class="sim-field"><label for="l-whats">WhatsApp</label><input type="tel" id="l-whats" name="whatsapp" autocomplete="tel" placeholder="(00) 00000-0000" required /></div>
        <div class="sim-field"><label for="l-email">E-mail (opcional)</label><input type="email" id="l-email" name="email" autocomplete="email" /></div>
        <div class="lead-hp" aria-hidden="true"><label>Não preencha<input type="text" id="l-website" name="website" tabindex="-1" autocomplete="off" /></label></div>
        <div class="lead-consent">
          <input type="checkbox" id="l-consent" required />
          <label for="l-consent">Autorizo o HRS Advocacia a entrar em contato sobre o meu caso e a tratar meus dados para essa finalidade, conforme a <a href="contato.html">política de privacidade</a> (LGPD). Posso solicitar a exclusão a qualquer momento.</label>
        </div>
        <button type="submit" class="btn-whatsapp" id="l-submit">Continuar</button>
        <a class="btn-whatsapp" id="l-whatsapp-btn" hidden target="_blank" rel="noopener">Abrir conversa no WhatsApp</a>
        <p class="lead-status" id="l-status"></p>
      </form>
    </div>`;
}

function renderEmConfiguracao() {
  return `
    <div class="sim-config">
      <h2>Simulador em configuração</h2>
      <p>Os parâmetros legais desta ferramenta estão sendo conferidos por um advogado do escritório antes de entrarem no ar. Enquanto isso, você pode falar diretamente com a nossa equipe para uma orientação sobre o seu crédito.</p>
      <a class="btn-whatsapp" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá, tenho um crédito contra o poder público e gostaria de uma orientação.')}" target="_blank" rel="noopener">Falar com o escritório</a>
    </div>
    <div class="sim-disclaimer">${DISCLAIMER}</div>`;
}

/**
 * @param {import('./tipos.js').EntradaSimulacao} entrada
 * @param {import('./tipos.js').ResultadoSimulacao} r
 */
function ligarLead(entrada, r) {
  const form = /** @type {HTMLFormElement} */ ($('leadForm'));
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('l-status');
    const nome = /** @type {HTMLInputElement} */ ($('l-nome')).value.trim();
    const whats = /** @type {HTMLInputElement} */ ($('l-whats')).value.trim();
    const email = /** @type {HTMLInputElement} */ ($('l-email')).value.trim();
    const consent = /** @type {HTMLInputElement} */ ($('l-consent')).checked;
    const honeypot = /** @type {HTMLInputElement} */ ($('l-website')).value;

    if (honeypot) return; // bot
    status.className = 'lead-status';
    if (!nome || !whats) { status.textContent = 'Informe seu nome e WhatsApp.'; status.classList.add('err'); return; }
    if (!consent) { status.textContent = 'É preciso autorizar o contato para prosseguir.'; status.classList.add('err'); return; }

    // Gravação do lead (só se houver endpoint configurado).
    if (LEAD_ENDPOINT) {
      try {
        await fetch(LEAD_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors', // Web App do Apps Script: evita preflight de CORS
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // requisição "simples"
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            nome, whatsapp: whats, email,
            ente: entrada.ente, natureza: entrada.naturezaCredito,
            valorBruto: entrada.valorBruto, classificacao: r.classificacao,
            consentimentoLGPD: consent, origem: origemUTM(),
            website: honeypot, // repassa o honeypot para a 2ª barreira no servidor
          }),
        });
      } catch { /* falha de rede não bloqueia o contato pelo usuário */ }
    }

    // Contato iniciado pelo usuário — em primeira pessoa (Provimento 205/2021).
    const msg = `Olá, usei o simulador de precatório/RPV no site e gostaria de uma análise do meu caso. Meu nome é ${nome}.`;
    const link = /** @type {HTMLAnchorElement} */ ($('l-whatsapp-btn'));
    link.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
    link.hidden = false;
    /** @type {HTMLButtonElement} */ ($('l-submit')).hidden = true;
    status.className = 'lead-status ok';
    status.textContent = 'Tudo certo! Toque no botão acima para abrir a conversa quando quiser.';
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
