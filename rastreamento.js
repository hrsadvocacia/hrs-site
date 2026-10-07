/* =====================================================================
   HRS Advocacia — rastreamento de origem e conversões
   ---------------------------------------------------------------------
   1. ORIGEM (funciona sem nenhuma conta configurada)
      Lê utm_*, gclid/fbclid/ttclid e o referrer, guarda na sessão e
      devolve uma etiqueta curta, ex.: "instagram/pago/rescisao-out26".
      A etiqueta vai no fim da mensagem de WhatsApp, então cada conversa
      chega dizendo de onde veio.

   2. PIXELS (opcionais) — preencha os IDs abaixo e publique.
      Campo vazio = script daquele serviço não é carregado.
   ===================================================================== */

window.HRS_RASTREAMENTO = window.HRS_RASTREAMENTO || {
  // Google Ads → Metas → Conversões → "Contato WhatsApp" → Configuração da tag
  googleAds: { id: '', /* ex.: 'AW-123456789' */ rotulo: '' /* ex.: 'AbCdEfGh123' */ },
  // Google Analytics 4 → Administrador → Fluxos de dados
  ga4: '', // ex.: 'G-XXXXXXX'
  // Meta (Instagram/Facebook) → Gerenciador de Eventos → Pixel
  metaPixel: '', // ex.: '123456789012345'
  // TikTok Ads Manager → Ferramentas → Eventos → Pixel
  tiktokPixel: '' // ex.: 'CABCDEFG12345'
};

(function () {
  'use strict';
  var C = window.HRS_RASTREAMENTO;
  var CHAVE = 'hrs_origem';

  /* ---------- Origem ---------- */
  function lerOrigem() {
    var p = new URLSearchParams(location.search);
    var src = p.get('utm_source'), med = p.get('utm_medium'), camp = p.get('utm_campaign');
    var o = null;

    if (src) {
      o = [src, med, camp].filter(Boolean).join('/');
    } else if (p.get('gclid') || p.get('gbraid') || p.get('wbraid')) {
      o = 'google/ads';
    } else if (p.get('fbclid')) {
      o = 'meta/clique';
    } else if (p.get('ttclid')) {
      o = 'tiktok/ads';
    } else if (document.referrer) {
      try {
        var h = new URL(document.referrer).hostname;
        if (h.indexOf(location.hostname) === -1) {
          var mapa = [
            ['instagram', 'instagram'], ['facebook', 'facebook'], ['tiktok', 'tiktok'],
            ['google', 'google/organico'], ['bing', 'bing'], ['whatsapp', 'whatsapp'],
            ['youtube', 'youtube'], ['jusbrasil', 'jusbrasil']
          ];
          for (var i = 0; i < mapa.length; i++) if (h.indexOf(mapa[i][0]) > -1) { o = mapa[i][1]; break; }
          if (!o) o = 'site:' + h.replace(/^www\./, '');
        }
      } catch (e) { /* referrer inválido */ }
    }

    var guardada = null;
    try { guardada = sessionStorage.getItem(CHAVE); } catch (e) { }
    if (o) { try { sessionStorage.setItem(CHAVE, o); } catch (e) { } return o; }
    return guardada || 'direto';
  }

  var ORIGEM = lerOrigem();

  /** Mantém os parâmetros de campanha ao navegar para outra página do site. */
  function comParametros(href) {
    var p = new URLSearchParams(location.search), keep = new URLSearchParams();
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      if (p.get(k)) keep.set(k, p.get(k));
    });
    var q = keep.toString();
    if (!q) return href;
    return href + (href.indexOf('?') > -1 ? '&' : '?') + q;
  }

  /* ---------- Carregamento dos pixels ---------- */
  function carregar(src) {
    var s = document.createElement('script'); s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  var gtagId = (C.googleAds && C.googleAds.id) || C.ga4;
  if (gtagId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    if (C.googleAds && C.googleAds.id) window.gtag('config', C.googleAds.id);
    if (C.ga4) window.gtag('config', C.ga4);
    carregar('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gtagId));
  }

  if (C.metaPixel) {
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', C.metaPixel);
    window.fbq('track', 'PageView');
  }

  if (C.tiktokPixel) {
    /* eslint-disable */
    !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"], ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }; for (var i = 0; i < ttq.methods.length; i++)ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++)ttq.setAndDefer(e, ttq.methods[n]); return e }, ttq.load = function (e, n) { var i = "https://analytics.tiktok.com/i18n/pixel/events.js"; ttq._i = ttq._i || {}, ttq._i[e] = [], ttq._i[e]._u = i, ttq._t = ttq._t || {}, ttq._t[e] = +new Date, ttq._o = ttq._o || {}, ttq._o[e] = n || {}; var o = d.createElement("script"); o.type = "text/javascript", o.async = !0, o.src = i + "?sdkid=" + e + "&lib=" + t; var a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a) }; ttq.load(C.tiktokPixel); ttq.page() }(window, document, 'ttq');
    /* eslint-enable */
  }

  /* ---------- Evento de contato (clique no WhatsApp) ---------- */
  function registrarContato(detalhes) {
    detalhes = detalhes || {};
    var area = detalhes.area || 'geral';
    try {
      if (window.gtag && C.googleAds && C.googleAds.id && C.googleAds.rotulo) {
        window.gtag('event', 'conversion', { send_to: C.googleAds.id + '/' + C.googleAds.rotulo });
      }
      if (window.gtag && C.ga4) {
        window.gtag('event', 'generate_lead', { area: area, origem: ORIGEM, pagina: location.pathname });
      }
      if (window.fbq) window.fbq('track', 'Contact', { content_category: area });
      if (window.ttq) window.ttq.track('Contact', { content_type: area });
    } catch (e) { /* rastreamento nunca bloqueia o contato */ }
  }

  /* Qualquer link de WhatsApp do site conta como contato.
     As landing pages marcam os próprios botões com .js-wa e registram sozinhas. */
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href*="wa.me/"]') : null;
    if (!a || a.classList.contains('js-wa')) return;
    registrarContato({ area: (document.body && document.body.getAttribute('data-area')) || 'geral' });
  }, true);

  window.HRS = window.HRS || {};
  window.HRS.origem = function () { return ORIGEM; };
  window.HRS.comParametros = comParametros;
  window.HRS.registrarContato = registrarContato;
})();
