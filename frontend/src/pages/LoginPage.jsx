import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import useAuthStore from '@store/authStore';
import branding from '../config/branding';
import { useI18n } from '../i18n';

/* ── Inline icon components ───────────────────────────────── */
function MailIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

/* ── Language switcher (shown on login page too) ──────────── */
function LoginLanguageSwitcher({ t, language, setLanguage }) {
  const next  = language === 'en' ? 'ar' : 'en';
  const label = language === 'en' ? 'العربية' : 'English';
  return (
    <button
      onClick={() => setLanguage(next)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/30 text-white/70 hover:text-white hover:border-white/60 text-sm transition-all"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
      {label}
    </button>
  );
}

/* ── LoginPage ────────────────────────────────────────────── */
function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from || '/dashboard';
  const { t, language, setLanguage, isRTL } = useI18n();

  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [form, setForm]               = useState({ email: '', password: '' });
  const [showPw, setShowPw]           = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    if (error) {
      toast.error(error, { id: 'auth-error' });
      clearError();
    }
  }, [error, clearError]);

  function validate() {
    const errors = {};
    if (!form.email)    errors.email    = t('validation.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                        errors.email    = t('validation.invalidEmail');
    if (!form.password) errors.password = t('validation.passwordRequired');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await login(form.email, form.password);
      toast.success(t('toast.loginSuccess'));
      navigate(from, { replace: true });
    } catch {
      // error already shown via the useEffect above
    }
  }

  return (
    <div className="min-h-screen flex bg-bg" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Left panel — branding ─────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-primary flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute bottom-32 -left-16 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 right-8 w-40 h-40 bg-secondary-500/20 rounded-full" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-16">
            <img
              src="/logo.svg"
              alt={branding.companyName}
              className="h-16 w-auto object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <LoginLanguageSwitcher t={t} language={language} setLanguage={setLanguage} />
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-4 font-arabic">
            {branding.companyName}
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-sm font-arabic">
            {branding.tagline}
          </p>
        </div>

        {/* Feature bullets */}
        <div className="relative z-10 space-y-4">
          {[
            { icon: '🏢', key: 'auth.features.portfolio' },
            { icon: '👥', key: 'auth.features.crm' },
            { icon: '📄', key: 'auth.features.contracts' },
            { icon: '📊', key: 'auth.features.reports' },
          ].map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-white/80 text-sm font-medium">{t(f.key)}</span>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-white/40 text-xs">
          {t('auth.internalNotice')}
        </p>
      </div>

      {/* ── Right panel — login form ──────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile: logo + language toggle */}
          <div className="flex items-center justify-between mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-800 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <span className="font-bold text-dark-800 text-lg">RE Manager</span>
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="text-sm text-primary-800 border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-50 transition-colors"
            >
              {language === 'en' ? 'العربية' : 'English'}
            </button>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-dark-800">{t('auth.welcomeBack')}</h2>
            <p className="text-dark-400 mt-2 text-sm">{t('auth.signInToContinue')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email" className="form-label">
                {t('auth.emailAddress')} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <span className={clsx(
                  'absolute inset-y-0 flex items-center text-dark-400 pointer-events-none',
                  isRTL ? 'end-3.5' : 'start-3.5'
                )}>
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder={t('auth.emailPlaceholder')}
                  value={form.email}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, email: e.target.value }));
                    setFieldErrors((err) => ({ ...err, email: undefined }));
                  }}
                  aria-invalid={!!fieldErrors.email}
                  className={clsx(
                    'input-base',
                    isRTL ? 'pe-3.5 ps-10' : 'ps-10 pe-3.5',
                    fieldErrors.email && 'input-error'
                  )}
                />
              </div>
              {fieldErrors.email && (
                <p className="form-error" role="alert">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="form-label">
                {t('auth.password')} <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <span className={clsx(
                  'absolute inset-y-0 flex items-center text-dark-400 pointer-events-none',
                  isRTL ? 'end-3.5' : 'start-3.5'
                )}>
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={form.password}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, password: e.target.value }));
                    setFieldErrors((err) => ({ ...err, password: undefined }));
                  }}
                  aria-invalid={!!fieldErrors.password}
                  className={clsx(
                    'input-base',
                    isRTL ? 'pe-11 ps-10' : 'ps-10 pe-11',
                    fieldErrors.password && 'input-error'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className={clsx(
                    'absolute inset-y-0 flex items-center text-dark-400 hover:text-dark-600 transition-colors',
                    isRTL ? 'start-3' : 'end-3'
                  )}
                  aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
              {fieldErrors.password && (
                <p className="form-error" role="alert">{fieldErrors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary btn-lg w-full mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('auth.signingIn')}
                </span>
              ) : (
                t('auth.signIn')
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-dark-100 text-center">
            <p className="text-xs text-dark-400">{t('auth.contactAdmin')}</p>
          </div>

          {/* Role legend */}
          <div className="mt-6 p-4 rounded-xl bg-primary-50 border border-primary-100">
            <p className="text-xs font-semibold text-primary-800 mb-2">{t('auth.accessLevels')}</p>
            <div className="space-y-1">
              {[
                { key: 'admin',    color: 'bg-primary-800',  initial: 'A' },
                { key: 'manager',  color: 'bg-warning',      initial: 'M' },
                { key: 'employee', color: 'bg-secondary-500',initial: 'E' },
              ].map(({ key, color, initial }) => (
                <div key={key} className="flex items-center gap-2 text-xs text-dark-500">
                  <span className={clsx('w-5 h-5 rounded-md text-white flex items-center justify-center font-bold text-2xs shrink-0', color)}>
                    {initial}
                  </span>
                  <span>
                    <strong>{t(`auth.roles.${key}`)}</strong>
                    {' — '}{t(`auth.roleDesc.${key}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
