/* ===== Menu mobile ===== */
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

/* ===== Sombra da navbar ao rolar ===== */
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  });
}

/* ===== Marca o link da página atual ===== */
(function () {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === 'index.html' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* ===== Animação de entrada ===== */
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(el => el.classList.add('in'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
})();

/* ===== Formulário de contato -> WhatsApp ===== */
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  // números por unidade
  const numeros = {
    teresina: '5586999854705',
    timon:    '5586988064858',
    goiania:  '5562983298288'
  };

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    const nome = (document.getElementById('cf-nome').value || '').trim();
    const area = document.getElementById('cf-area').value;
    const unidade = document.getElementById('cf-unidade').value;
    const msg = (document.getElementById('cf-msg').value || '').trim();

    const numero = numeros[unidade] || numeros.teresina;

    let texto = 'Olá! Vim pelo site do HRS Advocacia.';
    if (nome) texto += `\nMeu nome é ${nome}.`;
    if (area) texto += `\nÁrea de interesse: ${area}.`;
    if (msg)  texto += `\n\n${msg}`;

    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener');
  });
})();
