/**
 * I18nProvider.jsx
 * ─────────────────────────────────────────────────────────────
 * Lightweight React-Context i18n system for REMS.
 * No external library required.
 *
 * HOW IT WORKS
 *   1. Reads the stored language from localStorage (key: rems_language).
 *   2. Defaults to 'en' if nothing is stored.
 *   3. Provides { t, language, setLanguage, isRTL } to any child component
 *      via the useI18n() hook.
 *   4. On language change:
 *      - Saves to localStorage so the choice survives refresh.
 *      - Sets document.documentElement.lang  ("en" | "ar")
 *      - Sets document.documentElement.dir   ("ltr" | "rtl")
 *      - Updates the Toaster fontFamily (via a custom event)
 *
 * USAGE
 *   Wrap your app in <I18nProvider> (see main.jsx).
 *   In any component: const { t, language, setLanguage, isRTL } = useI18n();
 *   Translate:        t('nav.dashboard')   → 'Dashboard' | 'لوحة التحكم'
 *   Interpolate:      t('users.confirmDelete.message', { name: 'Ali' })
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from './locales/en';
import ar from './locales/ar';

// ── Locale registry ───────────────────────────────────────────
const LOCALES = { en, ar };

const STORAGE_KEY = 'rems_language';
const DEFAULT_LANG = 'en';

// ── Context ───────────────────────────────────────────────────
const I18nContext = createContext(null);

/**
 * Resolve a dot-separated key against a locale object.
 * Returns the key itself if not found (safe fallback).
 *
 * @param {object} locale   - the full locale object (en or ar)
 * @param {string} key      - dot path, e.g. "nav.dashboard"
 * @param {object} [vars]   - optional interpolation { name: 'Ali' }
 * @returns {string}
 */
function resolve(locale, key, vars) {
  const parts = key.split('.');
  let node = locale;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return key;
    node = node[part];
  }
  if (typeof node !== 'string') return key;

  // Simple {varName} interpolation
  if (vars && typeof vars === 'object') {
    return node.replace(/\{(\w+)\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
    );
  }
  return node;
}

/**
 * Apply language to the document root element.
 * Called on every language change so dir/lang are always in sync.
 */
function applyToDocument(lang) {
  const locale = LOCALES[lang] ?? LOCALES[DEFAULT_LANG];
  document.documentElement.lang = lang;
  document.documentElement.dir  = locale.lang.dir;
}

// ── Provider component ────────────────────────────────────────
export function I18nProvider({ children }) {
  // Initialise from localStorage, fall back to DEFAULT_LANG
  const [language, setLanguageState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && LOCALES[stored] ? stored : DEFAULT_LANG;
  });

  // Apply to document on mount and when language changes
  useEffect(() => {
    applyToDocument(language);
  }, [language]);

  const setLanguage = useCallback((lang) => {
    if (!LOCALES[lang]) {
      console.warn(`[i18n] Unknown language: "${lang}". Falling back to "${DEFAULT_LANG}".`);
      lang = DEFAULT_LANG;
    }
    localStorage.setItem(STORAGE_KEY, lang);
    setLanguageState(lang);
  }, []);

  const locale = LOCALES[language] ?? LOCALES[DEFAULT_LANG];
  const isRTL  = locale.lang.dir === 'rtl';

  /**
   * t(key, vars?) — translate a key with optional interpolation.
   * Falls back to the English string when the Arabic key is missing,
   * then falls back to the key string itself.
   */
  const t = useCallback((key, vars) => {
    const result = resolve(locale, key, vars);
    // If not found in current locale, fall back to English
    if (result === key && language !== DEFAULT_LANG) {
      const fallback = resolve(LOCALES[DEFAULT_LANG], key, vars);
      return fallback !== key ? fallback : key;
    }
    return result;
  }, [locale, language]);

  return (
    <I18nContext.Provider value={{ t, language, setLanguage, isRTL, locale }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────
/**
 * useI18n() — access the translation context in any component.
 *
 * Returns:
 *   t(key, vars?)   — translate a key
 *   language        — current language code ('en' | 'ar')
 *   setLanguage(l)  — switch language
 *   isRTL           — boolean, true when Arabic is active
 *   locale          — the full locale object (rarely needed directly)
 */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n() must be used inside <I18nProvider>');
  }
  return ctx;
}

export default I18nProvider;
