// =========================
//  AOS + i18n + UI helpers
// =========================

// ---------- Utilities ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const debounce = (fn, ms = 150) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

// ---------- i18n basics ----------
const I18N_KEYS_ATTR = '[data-i18n]';
const SUPPORTED = ['en', 'ar'];
const FALLBACK = 'en';

const getSavedLang = () => {
  const saved = localStorage.getItem('lang');
  if (saved && SUPPORTED.includes(saved)) return saved;
  const browserLang = navigator.language || navigator.userLanguage || '';
  return browserLang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
};
let currentLang = getSavedLang();

// ---------- i18n helpers ----------
async function fetchDict(lang) {
  const safe = SUPPORTED.includes(lang) ? lang : FALLBACK;
  const res = await fetch(`/i18n/${safe}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load i18n ${safe}`);
  return res.json();
}

function paintStrings(dict) {
  $$(I18N_KEYS_ATTR).forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && dict[key] != null) el.textContent = dict[key];
  });
}

function updateLangUI(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

function hideTranslatableContent() {
  $$(I18N_KEYS_ATTR).forEach(el => {
    el.style.visibility = 'hidden';
  });
}
function showTranslatableContent() {
  $$(I18N_KEYS_ATTR).forEach(el => {
    el.style.visibility = 'visible';
  });
}

// Main setter with guards + spinner support
async function setLanguage(lang, { withSpinner = false, initialLoad = false } = {}) {
  const next = SUPPORTED.includes(lang) ? lang : FALLBACK;

  if (next === currentLang && !initialLoad) {
    if (withSpinner) $('#langSpinner')?.classList.remove('active');
    return;
  }

  if (withSpinner) $('#langSpinner')?.classList.add('active');

  try {
    if (initialLoad) hideTranslatableContent();

    const dict = await fetchDict(next);
    paintStrings(dict);
    updateLangUI(next);

    currentLang = next;
    localStorage.setItem('lang', next);

    if (initialLoad) showTranslatableContent();

    // Recompute AOS after content size/flow changes
    if (window.AOS?.refreshHard) window.AOS.refreshHard();
  } catch (e) {
    if (next !== 'en') {
      await setLanguage('en', { withSpinner, initialLoad });
    }
  } finally {
    if (withSpinner) setTimeout(() => $('#langSpinner')?.classList.remove('active'), 500);
  }
}

// ---------- DOM-dependent logic ----------
document.addEventListener('DOMContentLoaded', async () => {
  // Auto-fix any accidental data-aso -> data-aos
  document.querySelectorAll('[data-aso]').forEach(el => {
    el.setAttribute('data-aos', el.getAttribute('data-aso'));
    el.removeAttribute('data-aso');
  });

  const header = $('#siteHeader');
  const sidebar = $('#sidebar');

  // Header scroll effect
  const headerObserver = () => {
    const cls = header?.classList;
    if (!cls) return;
    const opaque = window.scrollY > 24;
    cls.toggle('bg-white', opaque);
    cls.toggle('shadow-lg', opaque);
    cls.toggle('backdrop-blur', !opaque);
    cls.toggle('bg-white/70', !opaque);
  };
  window.addEventListener('scroll', headerObserver, { passive: true });
  headerObserver();

  // Sidebar helpers
  const getSidebar = () => document.querySelector('#sidebar');
  const openSidebar = () => {
    const sb = getSidebar();
    if (!sb) return;
    sb.setAttribute('data-open', 'true');
    requestAnimationFrame(() => window.AOS?.refreshHard());
  };
  const closeSidebar = () => {
    const sb = getSidebar();
    if (!sb) return;
    sb.removeAttribute('data-open');
    requestAnimationFrame(() => window.AOS?.refreshHard());
  };

  // One-button toggle + dedicated close button (if present)
  document.addEventListener('click', e => {
    const openBtn = e.target.closest('#openSidebar');
    const closeBtn = e.target.closest('#closeSidebar');
    const sb = getSidebar();

    if (openBtn) sb?.hasAttribute('data-open') ? closeSidebar() : openSidebar();
    if (closeBtn) closeSidebar();
  });

  sidebar?.addEventListener('click', e => {
    if (e.target.tagName === 'A') closeSidebar();
  });

  // Init html lang/dir then load i18n FIRST
  updateLangUI(currentLang);
  await setLanguage(currentLang, { initialLoad: true });

  // NOW init AOS (after i18n/layout is painted)
  // NOTE: remove any earlier AOS.init calls in your code.
  window.AOS?.init({
    duration: 800,
    once: true, // replay when re-entering viewport
    mirror: false, // no reverse-play on scroll-up (more stable)
    offset: 80,
    easing: 'ease-out',
    disable: 'mobile'
  });

  // After all resources load, recompute
  window.addEventListener('load', () => window.AOS?.refreshHard());

  // Refresh on resize / potential layout shifts
  window.addEventListener(
    'resize',
    debounce(() => window.AOS?.refreshHard(), 200),
  );

  // Language toggle example
  document.addEventListener('click', async e => {
    const btn = e.target.closest('#langToggle');
    if (!btn) return;

    const next = currentLang === 'en' ? 'ar' : 'en';
    const langShort = $('#langShort');
    if (langShort) langShort.textContent = next === 'ar' ? 'EN' : 'AR';
    await setLanguage(next, { withSpinner: true });
    requestAnimationFrame(() => window.AOS?.refreshHard());
  });
});
