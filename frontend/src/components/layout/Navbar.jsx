import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import Avatar from '../common/Avatar';
import useAuthStore from '../../store/authStore';
import { useI18n } from '../../i18n';

/* ── Dropdown wrapper ────────────────────────────────────── */
function Dropdown({ trigger, children, align = 'right', width = 'w-72' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={clsx(
            'absolute top-full mt-2 z-dropdown bg-white rounded-xl shadow-dropdown border border-dark-100',
            'animate-fade-in-down',
            width,
            align === 'right' ? 'end-0' : 'start-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Language switcher button ────────────────────────────── */
function LanguageSwitcher() {
  const { language, setLanguage, isRTL } = useI18n();

  const next   = language === 'en' ? 'ar' : 'en';
  const label  = language === 'en' ? 'العربية' : 'English';
  const title  = language === 'en' ? 'Switch to Arabic' : 'Switch to English';

  return (
    <button
      onClick={() => setLanguage(next)}
      title={title}
      aria-label={title}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 text-sm font-medium select-none',
        'border-dark-200 bg-white text-dark-700',
        'hover:border-primary-800 hover:text-primary-800 hover:bg-primary-50',
        isRTL ? 'font-cairo' : 'font-poppins'
      )}
    >
      {/* Globe icon */}
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
      <span className={language === 'ar' ? 'font-cairo' : ''}>{label}</span>
    </button>
  );
}

/* ── Main Navbar ─────────────────────────────────────────── */
function Navbar({ onToggleSidebar, sidebarCollapsed }) {
  const navigate  = useNavigate();
  const { user, logout } = useAuthStore();
  const { t, isRTL }     = useI18n();

  const [searchFocused, setSearchFocused] = useState(false);
  const [signingOut,    setSigningOut]    = useState(false);

  /* Derive a human-readable role label */
  const roleLabelText = user?.role ? t(`navbar.roleLabel.${user.role}`) : '';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <header
      className="h-header shrink-0 bg-white border-b border-dark-100 flex items-center gap-4 px-4 lg:px-6 z-sticky"
      role="banner"
    >
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg text-dark-500 hover:bg-dark-100 hover:text-dark-800 transition-colors shrink-0"
        aria-label={sidebarCollapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {sidebarCollapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
          )}
        </svg>
      </button>

      {/* Search bar */}
      <div
        className={clsx(
          'flex-1 max-w-md hidden sm:flex items-center gap-2.5 px-3.5 h-9 rounded-lg border transition-all duration-200',
          searchFocused
            ? 'border-primary-800 ring-2 ring-primary-800/20 bg-white'
            : 'border-dark-200 bg-dark-50 hover:border-dark-300'
        )}
      >
        <svg className="w-4 h-4 text-dark-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder={t('navbar.searchPlaceholder')}
          className="flex-1 bg-transparent text-sm text-dark-800 placeholder:text-dark-400 outline-none min-w-0"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1 sm:flex-none" />

      {/* Right controls */}
      <div className="flex items-center gap-2">

        {/* ── Language switcher ──────────────────────── */}
        <LanguageSwitcher />

        {/* ── User menu ──────────────────────────────── */}
        <Dropdown
          align="right"
          width="w-56"
          trigger={
            <button
              className="flex items-center gap-2.5 ps-1 pe-3 py-1 rounded-xl hover:bg-dark-100 transition-colors"
              aria-label={t('userMenu.profile')}
            >
              <Avatar name={user?.name || '?'} size="sm" status="online" />
              <div className="hidden md:block text-start">
                <p className="text-sm font-semibold text-dark-800 leading-none truncate max-w-[120px]">
                  {user?.name ?? 'User'}
                </p>
                <p className="text-xs text-dark-400 mt-0.5">{roleLabelText}</p>
              </div>
              {/* Chevron — flips for RTL via logical property / CSS */}
              <svg
                className={clsx('w-4 h-4 text-dark-400 hidden md:block shrink-0 transition-transform', isRTL && 'scale-x-[-1]')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          }
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-dark-100">
            <p className="text-sm font-semibold text-dark-800 truncate">{user?.name ?? 'User'}</p>
            <p className="text-xs text-dark-400 mt-0.5 truncate">{user?.email ?? ''}</p>
            <span className="mt-1 inline-block text-2xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full font-medium capitalize">
              {roleLabelText}
            </span>
          </div>

          <div className="py-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-dark-600 hover:bg-dark-50 hover:text-dark-800 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {t('userMenu.dashboard')}
            </button>
          </div>

          {/* Sign out */}
          <div className="border-t border-dark-100 py-1">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors disabled:opacity-50"
            >
              {signingOut ? (
                <span className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin shrink-0" />
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
              {signingOut ? t('auth.signingOut') : t('auth.signOut')}
            </button>
          </div>
        </Dropdown>
      </div>
    </header>
  );
}

export default Navbar;
