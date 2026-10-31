/**
 * i18n/index.js — barrel export for the i18n system.
 * Import from here to avoid deep relative paths in components.
 *
 * Usage:
 *   import { useI18n, I18nProvider } from '../i18n';
 *   import { useI18n } from '@/i18n';  (with vite path alias)
 */
export { I18nProvider, useI18n } from './I18nProvider';
