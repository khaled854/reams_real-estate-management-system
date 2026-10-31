/**
 * branding.js
 * ─────────────────────────────────────────────────────────────
 * Central branding configuration for سوق العقارات.
 *
 * HOW TO UPDATE:
 *   1. Replace the logo file at /public/logo.png  (or point logoPath below)
 *   2. Change any value in this file
 *   3. The changes propagate automatically to Login, Sidebar,
 *      Navbar, Reports, Favicon, and <title>
 *
 * All components import from this file — never hard-code
 * company name or logo paths directly in components.
 * ─────────────────────────────────────────────────────────────
 */

const branding = {
  // ── Identity ────────────────────────────────────────────────
  /** Full Arabic name displayed in headings */
  companyName: 'سوق العقارات',

  /** Short name used in confined spaces (sidebar collapsed tooltip, <title>) */
  companyNameShort: 'سوق العقارات',

  /** English tagline shown under the logo on the login page */
  tagline: 'نظام إدارة العقارات',

  /** Sub-tagline shown under the logo in the sidebar */
  sidebarTagline: 'جريدة إعلانية متخصصة في تسويق العقارات',

  // ── Logo paths (relative to /public) ────────────────────────
  /**
   * Primary logo — used on Login page (large, light background).
   * Place the file at:  frontend/public/logo.png
   */
  logoPath: '/logo.png',

  /**
   * White / inverted version — used on the dark sidebar.
   * If you only have one logo, set this to the same path and use
   * CSS filter: brightness(0) invert(1) via the logoWhite flag below.
   */
  logoWhitePath: '/logo-white.png',

  /**
   * When true the sidebar logo is rendered using a CSS invert filter
   * instead of requiring a separate white logo file.
   * Set to false when logoWhitePath points to a real white logo.
   */
  invertLogoOnDark: true,

  /**
   * Favicon path.  Also update the <link rel="icon"> in index.html
   * to match this path when using a .png favicon.
   */
  faviconPath: '/favicon.svg',

  // ── Brand colors ─────────────────────────────────────────────
  /** Must match tailwind.config.js primary-800 */
  primaryColor:   '#1E40AF',

  /** Must match tailwind.config.js secondary-500 */
  secondaryColor: '#F97316',

  // ── Contact information ──────────────────────────────────────
  contact: {
    email:   'info@souq-aqarat.com',
    phone:   '+966 XX XXX XXXX',
    address: 'المملكة العربية السعودية',
    website: 'www.souq-aqarat.com',
  },

  // ── Footer / legal ───────────────────────────────────────────
  copyrightYear: new Date().getFullYear(),
  footerNote:    'نظام داخلي — للاستخدام الداخلي فقط',

  // ── App version (shown in sidebar footer) ───────────────────
  version: '1.0.0',
};

export default branding;
