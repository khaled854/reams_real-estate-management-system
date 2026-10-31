/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],

  theme: {
    extend: {
      // ─── Brand Colors ──────────────────────────────────────────────
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1E40AF',   // ← brand Royal Blue
          900: '#1e3a8a',
          950: '#172554',
          DEFAULT: '#1E40AF',
        },
        secondary: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#F97316',   // ← brand Orange
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          DEFAULT: '#F97316',
        },
        dark: {
          50:  '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1F2937',   // ← brand Dark
          900: '#111827',
          DEFAULT: '#1F2937',
        },
        bg: {
          DEFAULT: '#F8FAFC',
          card:    '#FFFFFF',
        },
        success: {
          light: '#dcfce7',
          DEFAULT: '#16a34a',
          dark:  '#14532d',
        },
        warning: {
          light: '#fef9c3',
          DEFAULT: '#ca8a04',
          dark:  '#713f12',
        },
        danger: {
          light: '#fee2e2',
          DEFAULT: '#dc2626',
          dark:  '#7f1d1d',
        },
        info: {
          light: '#e0f2fe',
          DEFAULT: '#0284c7',
          dark:  '#0c4a6e',
        },
      },

      // ─── Typography ────────────────────────────────────────────────
      fontFamily: {
        sans:    ['Poppins', 'system-ui', 'sans-serif'],
        arabic:  ['Cairo', 'system-ui', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        cairo:   ['Cairo', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        xs:    ['0.75rem',  { lineHeight: '1rem' }],
        sm:    ['0.875rem', { lineHeight: '1.25rem' }],
        base:  ['1rem',     { lineHeight: '1.5rem' }],
        lg:    ['1.125rem', { lineHeight: '1.75rem' }],
        xl:    ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem',   { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl': ['3rem',     { lineHeight: '1' }],
      },

      // ─── Shadows ───────────────────────────────────────────────────
      boxShadow: {
        xs:    '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm:    '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md:    '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg:    '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl:    '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        card:  '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 8px 25px -5px rgb(30 64 175 / 0.12), 0 4px 10px -5px rgb(30 64 175 / 0.08)',
        primary: '0 4px 14px 0 rgb(30 64 175 / 0.35)',
        secondary: '0 4px 14px 0 rgb(249 115 22 / 0.35)',
        inner:  'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)',
        none:   'none',
      },

      // ─── Border Radius ─────────────────────────────────────────────
      borderRadius: {
        none: '0',
        sm:   '0.25rem',
        DEFAULT: '0.375rem',
        md:   '0.5rem',
        lg:   '0.75rem',
        xl:   '1rem',
        '2xl':'1.5rem',
        '3xl':'2rem',
        full: '9999px',
      },

      // ─── Spacing extras ────────────────────────────────────────────
      spacing: {
        sidebar:         '16rem',   // 256px expanded
        'sidebar-collapsed': '4.5rem', // 72px collapsed
        header:          '4rem',    // 64px navbar
      },

      // ─── Transitions ───────────────────────────────────────────────
      transitionDuration: {
        DEFAULT: '200ms',
        fast:    '100ms',
        slow:    '400ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // ─── Animation ─────────────────────────────────────────────────
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in':       'fadeIn 200ms ease-out',
        'fade-in-down':  'fadeInDown 250ms ease-out',
        'fade-in-up':    'fadeInUp 250ms ease-out',
        'scale-in':      'scaleIn 200ms ease-out',
        'slide-in-right':'slideInRight 250ms ease-out',
        shimmer:         'shimmer 1.5s infinite linear',
        spin:            'spin 0.8s linear infinite',
        pulse:           'pulse 2s ease-in-out infinite',
      },

      // ─── Z-index scale ─────────────────────────────────────────────
      zIndex: {
        dropdown: '1000',
        sticky:   '1020',
        fixed:    '1030',
        backdrop: '1040',
        modal:    '1050',
        popover:  '1060',
        tooltip:  '1070',
      },
    },
  },

  plugins: [],
};
