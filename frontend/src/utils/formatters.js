/**
 * formatters.js
 * ─────────────────────────────────────────────────────────────
 * Locale-aware utility functions for numbers, currency, and dates.
 *
 * All public functions accept an optional `locale` parameter
 * (e.g. 'en-US' or 'ar-EG') so they can react to the selected
 * language without depending directly on the React context.
 *
 * Usage inside a React component:
 *   const { language } = useI18n();
 *   const loc = language === 'ar' ? 'ar-EG' : 'en-US';
 *   formatCurrency(50000, 'SAR', loc)  →  "SAR 50,000" | "٥٠٬٠٠٠ ر.س."
 *
 * The database always stores dates and numbers in their neutral
 * formats — only the *presentation* layer uses locale formatting.
 */

import { format, parseISO } from 'date-fns';

// ── Locale helpers ────────────────────────────────────────────

/** Map language code to BCP-47 locale string */
export function langToLocale(language = 'en') {
  return language === 'ar' ? 'ar-EG' : 'en-US';
}

// ── Currency ──────────────────────────────────────────────────

/**
 * Format a number as currency.
 *
 * @param {number} amount
 * @param {string} [currency='SAR']   ISO 4217 currency code
 * @param {string} [locale='en-US']   BCP-47 locale (use langToLocale())
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'SAR', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style:                 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

/**
 * Compact currency format (e.g. "SAR 1.2M" | "١٫٢ م ر.س.").
 */
export function formatCurrencyCompact(amount, currency = 'SAR', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style:                 'currency',
    currency,
    minimumFractionDigits: 0,
    notation:              'compact',
  }).format(amount ?? 0);
}

// ── Numbers ───────────────────────────────────────────────────

/**
 * Format a plain number with locale-appropriate digit/separator style.
 *
 * @param {number} value
 * @param {string} [locale='en-US']
 * @returns {string}
 */
export function formatNumber(value, locale = 'en-US') {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

// ── Dates ─────────────────────────────────────────────────────

/**
 * Format an ISO date string to a readable date.
 *
 * @param {string} isoString    ISO 8601 string from the database
 * @param {string} [fmt]        date-fns format string (used for 'en'); for 'ar'
 *                              we use Intl.DateTimeFormat instead to get Arabic numerals
 * @param {string} [locale]     BCP-47 locale override
 * @returns {string}
 */
export function formatDate(isoString, fmt = 'MMM d, yyyy', locale = 'en-US') {
  if (!isoString) return '—';
  try {
    const date = parseISO(isoString);
    if (isNaN(date.getTime())) return isoString;

    // For Arabic locale use Intl.DateTimeFormat to get localised digits & month names
    if (locale.startsWith('ar')) {
      return new Intl.DateTimeFormat(locale, {
        year:  'numeric',
        month: 'short',
        day:   'numeric',
      }).format(date);
    }

    return format(date, fmt);
  } catch {
    return isoString;
  }
}

/**
 * Format a Date object or ISO string as a short relative time label.
 * e.g. "2 days ago" | "منذ يومان"
 *
 * Note: uses Intl.RelativeTimeFormat which is widely supported.
 *
 * @param {string|Date} value
 * @param {string} [locale='en-US']
 * @returns {string}
 */
export function formatRelativeTime(value, locale = 'en-US') {
  if (!value) return '—';
  try {
    const date     = typeof value === 'string' ? parseISO(value) : value;
    const diffMs   = Date.now() - date.getTime();
    const diffSec  = Math.floor(diffMs / 1000);
    const diffMin  = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay  = Math.floor(diffHour / 24);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (diffSec  <  60)  return locale.startsWith('ar') ? 'الآن' : 'Just now';
    if (diffMin  <  60)  return rtf.format(-diffMin,  'minute');
    if (diffHour <  24)  return rtf.format(-diffHour, 'hour');
    if (diffDay  < 365)  return rtf.format(-diffDay,  'day');
    return formatDate(typeof value === 'string' ? value : value.toISOString(), 'MMM yyyy', locale);
  } catch {
    return '—';
  }
}

// ── File size ─────────────────────────────────────────────────

/**
 * Format a file size in bytes to a human-readable string.
 * (Not locale-dependent — uses neutral units.)
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k     = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ── String ────────────────────────────────────────────────────

/**
 * Truncate a string to a max length, appending '…'.
 *
 * @param {string} str
 * @param {number} [maxLength=50]
 * @returns {string}
 */
export function truncate(str, maxLength = 50) {
  if (!str) return '';
  return str.length <= maxLength ? str : `${str.slice(0, maxLength)}…`;
}
