// @ts-check
/**
 * Controlador da interface do Simulador de Verbas Rescisórias.
 * Carrega os parâmetros, conduz o wizard de 4 passos, chama o motor puro
 * (rescisao-engine.js) e renderiza o resultado + captura de lead.
 *
 * @module simulador/rescisao-wizard
 */
import { simularRescisao, ParametroPendenteError, EntradaInvalidaError } from './rescisao-engine.js';

/** @typedef {import('./rescisao-tipos.js').ParametrosRescisao} ParametrosRescisao */
/** @typedef {import('./rescisao-tipos.js').EntradaRescisao} EntradaRescisao */
/** @typedef {import('./rescisao-tipos.js').ResultadoRescisao} ResultadoRescisao */

// ─── Configuração ───────────────────────────────────────────────────────────
// Mesmo modelo do simulador de precatório: enquanto vazio, o lead NÃO é
// enviado por rede — o contato acontece só pelo WhatsApp iniciado pelo usuário
// (modelo passivo, conforme Provimento 205/2021).
const LEAD_ENDPOINT = '';
const WHATSAPP = '5586999854705';

const DISCLAIMER =
  'Esta é uma ferramenta informativa e gratuita. O resultado é uma <strong>estimativa</strong> ' +
  'baseada nas informações fornecidas e nos parâmetros legais vigentes, e <strong>não constitui ' +
  'consulta, parecer ou promessa de resultado</strong>. Os valores dependem do contrato, da convenção ' +
  'coletiva da categoria, de adicionais e de verbas variáveis que esta ferramenta não conhece. Somente ' +
  'a análise dos documentos por advogado permite conclusão segura.';

const PASSOS = [
  'Como o contrato terminou?',
  'Contrato e remuneração',
  'Aviso prévio, férias e FGTS',
  'Resultado',
];

/** Situações de aviso prévio oferecidas em cada modalidade. */
const OPCOES_AVISO = {
  empregador: [
    { valor: 'indenizado', titulo: 'Indenizado (não trabalhado)', desc: 'O contrato termina na hora e o aviso é pago em dinheiro. Ele projeta o tempo de serviço e aumenta o 13º e as férias.' },
    { valor: 'trabalhado', titulo: 'Trabalhado', desc: 'Cumprido em serviço. Informe como data de saída o último dia do aviso.' },
  ],
  empregado: [
    { valor: 'trabalhado', titulo: 'Vou cumprir (ou já cumpri)', desc: 'Trabalhando os 30 dias, não há desconto.' },
    { valor: 'dispensado', titulo: 'O empregador me dispensou de cumprir', desc: 'Sem cumprimento e sem desconto.' },
    { valor: 'nao_cumprido', titulo: 'Não cumpri o aviso', desc: 'O empregador pode descontar 30 dias de remuneração (art. 487, §2º, da CLT).' },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** @param {number} n */
const fmtBRL = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @param {string} s */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

/** @param {string} iso */
function dataBR(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** Máscara de moeda: mantém só dígitos, interpreta como centavos. @param {HTMLInputElement} el */
function aplicarMascaraMoeda(el) {
  const digitos = el.value.replace(/\D/g, '');
  if (!digitos) { el.value = ''; return; }
  el.value = fmtBRL(parseInt(digitos, 10) / 100);
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
/** @type {ParametrosRescisao | null} */
let PARAMS = null;

// ─── Inicialização ───────────────────────────────────────────────────────────
async function init() {
  const form = $('simForm');
  if (!form) return;
  try {
    const resp = await fetch('data/parametros-rescisao.json', { cache: 'no-store' });
    PARAMS = await resp.json();
  } catch {
    PARAMS = null;
  }
  popularModalidades();
  ligarEventos();
  irParaPasso(1);
}

function popularModalidades() {
  const alvo = $('opcoesModalidade');
  if (!alvo || !PARAMS) return;
  alvo.innerHTML = Object.entries(PARAMS.modalidades).map(([id, m], i) => `
    <label class="sim-option">
      <input type="radio" name="modalidade" value="${esc(id)}" ${i === 0 ? 'checked' : ''} />
      <span><span class="sim-option-title">${esc(m.rotulo)}</span><span class="sim-option-desc">${esc(m.descricao)}</span></span>
    </label>`).join('');
  alvo.addEventListener('change', renderOpcoesAviso);
}

/** Reescreve as opções de aviso prévio conforme a modalidade escolhida. */
function renderOpcoesAviso() {
  const alvo = $('opcoesAviso');
  const wrap = $('wrap-aviso');
  if (!alvo || !PARAMS) return;
  const id = modalidadeSelecionada();
  const regra = PARAMS.modalidades[id];
  const devidoPor = regra ? regra.avisoPrevio.devidoPor : 'nenhum';

  if (devidoPor === 'nenhum') {
    wrap.hidden = true;
    alvo.innerHTML = '<input type="radio" name="aviso" value="dispensado" checked hidden />';
    return;
  }
  wrap.hidden = false;
  const opcoes = OPCOES_AVISO[devidoPor === 'empregador' ? 'empregador' : 'empregado'];
  $('lbl-aviso').textContent = devidoPor === 'empregador'
    ? 'Como ficou o aviso prévio devido a você?'
    : 'Como ficou o aviso prévio que você deve ao empregador?';
  alvo.innerHTML = opcoes.map((o, i) => `
    <label class="sim-option">
      <input type="radio" name="aviso" value="${o.valor}" ${i === 0 ? 'checked' : ''} />
      <span><span class="sim-option-title">${esc(o.titulo)}</span><span class="sim-option-desc">${esc(o.desc)}</span></span>
    </label>`).join('');
}

/** @returns {string} */
function modalidadeSelecionada() {
  const el = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="modalidade"]:checked'));
  return el ? el.value : '';
}

function ligarEventos() {
  $('btnNext').addEventListener('click', () => { if (validarPasso(passo)) irParaPasso(passo + 1); });
  $('btnBack').addEventListener('click', () => irParaPasso(passo - 1));
  $('simForm').addEventListener('submit', (e) => { e.preventDefault(); if (validarPasso(3)) calcular(); });

  for (const id of ['f-salario', 'f-medias', 'f-fgts']) {
    const el = /** @type {HTMLInputElement} */ ($(id));
    el.addEventListener('input', () => aplicarMascaraMoeda(el));
  }
}

// ─── Navegação ───────────────────────────────────────────────────────────────
/** @param {number} n */
function irParaPasso(n) {
  passo = Math.min(3, Math.max(1, n));
  for (let i = 1; i <= 3; i++) $('step' + i).hidden = i !== passo;
  if (passo === 3) renderOpcoesAviso();
  document.querySelectorAll('#simProgress li').forEach((li, i) => {
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
    const ok = !!modalidadeSelecionada();
    erro('err-modalidade', !ok);
    return ok;
  }
  if (n === 2) {
    const salario = valorNumerico(/** @type {HTMLInputElement} */ ($('f-salario')));
    const admissao = /** @type {HTMLInputElement} */ ($('f-admissao')).value;
    const saida = /** @type {HTMLInputElement} */ ($('f-saida')).value;
    const hojeISO = new Date().toISOString().slice(0, 10);

    const okSalario = salario > 0;
    const okAdmissao = !!admissao && admissao <= hojeISO;
    const okSaida = !!saida && !!admissao && saida >= admissao;
    erro('err-salario', !okSalario);
    erro('err-admissao', !okAdmissao);
    erro('err-saida', !okSaida);
    return okSalario && okAdmissao && okSaida;
  }
  if (n === 3) {
    const periodos = Number(/** @type {HTMLInputElement} */ ($('f-feriasVencidas')).value || '0');
    const ok = Number.isInteger(periodos) && periodos >= 0 && periodos <= 2;
    erro('err-feriasVencidas', !ok);
    return ok;
  }
  return true;
}

// ─── Cálculo + render ────────────────────────────────────────────────────────
function calcular() {
  if (!PARAMS) return;
  const avisoEl = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="aviso"]:checked'));
  const fgts = valorNumerico(/** @type {HTMLInputElement} */ ($('f-fgts')));

  /** @type {EntradaRescisao} */
  const entrada = {
    modalidade: /** @type {any} */ (modalidadeSelecionada()),
    salarioMensal: valorNumerico(/** @type {HTMLInputElement} */ ($('f-salario'))),
    dataAdmissao: /** @type {HTMLInputElement} */ ($('f-admissao')).value,
    dataSaida: /** @type {HTMLInputElement} */ ($('f-saida')).value,
    situacaoAviso: /** @type {any} */ (avisoEl ? avisoEl.value : 'dispensado'),
    feriasVencidasPeriodos: Number(/** @type {HTMLInputElement} */ ($('f-feriasVencidas')).value || '0'),
    mediaVariaveisMensal: valorNumerico(/** @type {HTMLInputElement} */ ($('f-medias'))),
    ...(fgts > 0 ? { saldoFGTSInformado: fgts } : {}),
  };

  const alvo = $('simResult');
  try {
    const r = simularRescisao(entrada, PARAMS);
    alvo.innerHTML = renderResultado(r);
    ligarLead(entrada, r);
  } catch (e) {
    if (e instanceof ParametroPendenteError) {
      alvo.innerHTML = renderEmConfiguracao();
    } else if (e instanceof EntradaInvalidaError) {
      alvo.innerHTML = `<div class="sim-config"><h2>Revise os dados</h2><p>${esc(e.message)}</p></div>`;
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

/** @param {ResultadoRescisao} r */
function renderResultado(r) {
  const devidas = r.verbas.filter((v) => v.devida);
  const naoDevidas = r.verbas.filter((v) => !v.devida);
  const bruto = !r.descontosFiscaisCalculados;

  const linhasDevidas = devidas.map((v) => `
    <div class="res-linha res-linha-verba">
      <span><span class="verba-nome">${esc(v.rotulo)}</span><span class="verba-memoria">${esc(v.memoria)}</span></span>
      <span class="val">${fmtBRL(v.valor)}</span>
    </div>`).join('');

  const linhasDescontos = r.descontos.map((d) => `
    <div class="res-linha res-linha-verba">
      <span><span class="verba-nome">${esc(d.rotulo)}</span><span class="verba-memoria">${esc(d.memoria)}</span></span>
      <span class="val val-neg">&minus; ${fmtBRL(d.valor)}</span>
    </div>`).join('');

  const blocoNaoDevidas = naoDevidas.length ? `
    <div class="res-card">
      <h3>O que não é devido nesta modalidade</h3>
      <ul class="res-nao-devidas">
        ${naoDevidas.map((v) => `<li><strong>${esc(v.rotulo)}</strong> — ${esc(v.motivoNaoDevida || '')}</li>`).join('')}
      </ul>
    </div>` : '';

  const fgtsPositivo = r.fgts.valorDisponivelSaque > 0;
  const blocoFGTS = `
    <div class="res-card ${fgtsPositivo ? 'res-fgts' : ''}">
      <h3>FGTS</h3>
      <div class="res-linha"><span>Saldo na conta vinculada${r.fgts.saldoEstimado ? ' (estimado)' : ''}</span><span class="val">${fmtBRL(r.fgts.saldoBase)}</span></div>
      <div class="res-linha"><span>Depósito rescisório (${PARAMS ? PARAMS.fgts.aliquotaDepositoPct : 8}% sobre as verbas salariais)</span><span class="val">${fmtBRL(r.fgts.depositoRescisorio)}</span></div>
      <div class="res-linha"><span>Multa rescisória (${r.fgts.multaPct}%)</span><span class="val">${fmtBRL(r.fgts.multaValor)}</span></div>
      <div class="res-liquido"><span class="lbl">Disponível para saque (${r.fgts.saquePct}%)</span><span class="val">${fmtBRL(r.fgts.valorDisponivelSaque)}</span></div>
      <p style="margin-top:12px;font-size:12.5px;color:#7d90ad;">${esc(r.fgts.observacao)}</p>
    </div>`;

  const alertas = r.alertas.length ? `
    <div class="res-card"><h3>Pontos de atenção</h3>
      <ul class="res-alertas">${r.alertas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
    </div>` : '';

  return `
    <div class="res-verdict ${bruto ? 'is-bruto' : 'is-rpv'}">
      <p class="res-tag">${bruto ? 'Total bruto estimado das verbas' : 'Líquido estimado das verbas'}</p>
      <p class="res-class res-class-valor">${fmtBRL(bruto ? r.totalBruto : r.liquidoEstimado)}</p>
      <p class="res-valor">${esc(r.rotuloModalidade)}${fgtsPositivo ? ` &middot; mais ${fmtBRL(r.fgts.valorDisponivelSaque)} de FGTS` : ''}</p>
    </div>

    <div class="res-card">
      <h3>Demonstrativo das verbas</h3>
      ${linhasDevidas}
      <div class="res-linha res-subtotal"><span>Total bruto</span><span class="val">${fmtBRL(r.totalBruto)}</span></div>
      ${linhasDescontos}
      <div class="res-liquido"><span class="lbl">${bruto ? 'Total bruto (sem INSS e IR)' : 'Líquido a receber'}</span><span class="val">${fmtBRL(r.liquidoEstimado)}</span></div>
      ${fgtsPositivo ? `<p class="res-total-geral">Somando o FGTS liberado, o total estimado chega a <strong>${fmtBRL(r.totalGeralEstimado)}</strong>.</p>` : ''}
    </div>

    ${blocoFGTS}

    <div class="res-card">
      <h3>Contrato considerado</h3>
      <div class="res-linha"><span>Tempo de casa</span><span class="val">${r.anosDeCasa} ${r.anosDeCasa === 1 ? 'ano completo' : 'anos completos'}</span></div>
      ${r.avisoPrevioDias > 0 ? `<div class="res-linha"><span>Aviso prévio apurado</span><span class="val">${r.avisoPrevioDias} dias</span></div>` : ''}
      ${r.houveProjecao ? `<div class="res-linha"><span>Contrato projetado até</span><span class="val">${dataBR(r.dataFimProjetada)}</span></div>` : ''}
      <div class="res-linha"><span>Remuneração-base</span><span class="val">${fmtBRL(r.remuneracaoBase)}</span></div>
    </div>

    <div class="res-card">
      <h3>Seguro-desemprego e prazo de pagamento</h3>
      <p><strong>${r.seguroDesemprego.direito ? 'Há direito' : 'Não há direito'}:</strong> ${esc(r.seguroDesemprego.texto)}</p>
      <p style="margin-top:10px;">${esc(r.prazoPagamento.texto)}</p>
    </div>

    ${blocoNaoDevidas}
    ${alertas}

    <details class="res-card res-premissas">
      <summary>Premissas usadas neste cálculo</summary>
      <ol>${r.premissas.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
    </details>

    <div class="sim-disclaimer">${DISCLAIMER}</div>

    ${renderLead()}
  `;
}

function renderLead() {
  return `
    <div class="lead-block" id="leadBlock">
      <h2>Quer conferir a sua rescisão com um advogado?</h2>
      <p class="lead-sub">Erro no cálculo, aviso prévio incorreto e verbas faltantes são mais comuns do que parece. Se preferir, deixe seu contato. O contato pelo WhatsApp é iniciado por você — não enviamos mensagens automáticas.</p>
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
      <p>Os parâmetros legais desta ferramenta estão sendo conferidos por um advogado do escritório antes de entrarem no ar. Enquanto isso, você pode falar diretamente com a nossa equipe sobre a sua rescisão.</p>
      <a class="btn-whatsapp" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá, gostaria de uma orientação sobre as minhas verbas rescisórias.')}" target="_blank" rel="noopener">Falar com o escritório</a>
    </div>
    <div class="sim-disclaimer">${DISCLAIMER}</div>`;
}

/**
 * @param {EntradaRescisao} entrada
 * @param {ResultadoRescisao} r
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

    if (LEAD_ENDPOINT) {
      try {
        await fetch(LEAD_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            simulador: 'verbas-rescisorias',
            nome, whatsapp: whats, email,
            modalidade: entrada.modalidade,
            salarioMensal: entrada.salarioMensal,
            totalBruto: r.totalBruto,
            consentimentoLGPD: consent, origem: origemUTM(),
            website: honeypot,
          }),
        });
      } catch { /* falha de rede não bloqueia o contato pelo usuário */ }
    }

    const msg = `Olá, usei o simulador de verbas rescisórias no site e gostaria de conferir o meu caso. Meu nome é ${nome}.`;
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
