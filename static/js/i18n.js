// ─────────────────────────────────────────────────────────────────
//  I18N — lightweight internationalization
//  Translation files: static/locales/{lang}.json
//  Usage: t('key'), t('key', {count: 5}), t('key', {name: 'x'})
// ─────────────────────────────────────────────────────────────────
'use strict';

const I18N = (() => {
  let _locale = 'en';
  const _messages = {};
  let _ready = false;

  // CLDR plural rules per language
  const _pluralRules = {
    en: (n) => n === 1 ? 'one' : 'other',
    fr: (n) => (n === 0 || n === 1) ? 'one' : 'other',
    de: (n) => n === 1 ? 'one' : 'other',
    ja: () => 'other',
  };

  function _pluralCategory(n) {
    return (_pluralRules[_locale] || _pluralRules.en)(n);
  }

  // Parse: {count, plural, =0 {none} one {# item} other {# items}}
  function _plural(tmpl, vars) {
    return tmpl.replace(
      /\{(\w+),\s*plural,\s*((?:(?:=\d+|zero|one|two|few|many|other)\s*\{[^}]*\}\s*)+)\}/g,
      (_, varName, branches) => {
        const n = Number(vars[varName]) || 0;
        const map = {};
        let m;
        const re = /(=\d+|zero|one|two|few|many|other)\s*\{([^}]*)\}/g;
        while ((m = re.exec(branches))) map[m[1]] = m[2];
        const result = map['=' + n] ?? map[_pluralCategory(n)] ?? map.other ?? '';
        return result.replace(/#/g, n);
      }
    );
  }

  // Parse: {key, select, val1 {text1} other {text2}}
  function _select(tmpl, vars) {
    return tmpl.replace(
      /\{(\w+),\s*select,\s*((?:\w+\s*\{[^}]*\}\s*)+)\}/g,
      (_, varName, branches) => {
        const val = String(vars[varName] || '');
        const map = {};
        let m;
        const re = /(\w+)\s*\{([^}]*)\}/g;
        while ((m = re.exec(branches))) map[m[1]] = m[2];
        return map[val] ?? map.other ?? '';
      }
    );
  }

  function t(key, vars) {
    let msg = (_messages[_locale]?.[key]) ?? (_messages.en?.[key]) ?? key;
    if (!vars) return msg;
    msg = _plural(msg, vars);
    msg = _select(msg, vars);
    return msg.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? String(vars[k]) : `{${k}}`);
  }

  async function _loadLocale(lang) {
    if (_messages[lang]) return;
    try {
      const r = await fetch(`/static/locales/${lang}.json`);
      if (r.ok) _messages[lang] = await r.json();
    } catch (e) {
      console.warn(`[i18n] Could not load "${lang}":`, e.message);
    }
  }

  function _detect() {
    const saved = localStorage.getItem('morewax-lang');
    if (saved) return saved;
    const nav = (navigator.language || 'en').split('-')[0].toLowerCase();
    return ['en', 'ja', 'fr', 'de'].includes(nav) ? nav : 'en';
  }

  async function init() {
    _locale = _detect();
    await _loadLocale('en');
    if (_locale !== 'en') await _loadLocale(_locale);
    _ready = true;
  }

  async function setLocale(lang) {
    _locale = lang;
    localStorage.setItem('morewax-lang', lang);
    await _loadLocale(lang);
    translateDOM();
    window.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale: lang } }));
  }

  function getLocale() { return _locale; }
  function isReady() { return _ready; }

  function translateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.documentElement.lang = _locale;
  }

  const _readyPromise = init();

  return { t, setLocale, getLocale, isReady, translateDOM, ready: _readyPromise };
})();

// Global shortcuts
const t = I18N.t;
const setLocale = I18N.setLocale;
const getLocale = I18N.getLocale;
const translateDOM = I18N.translateDOM;
