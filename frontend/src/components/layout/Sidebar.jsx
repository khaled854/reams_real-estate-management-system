import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect }  from 'react';
import clsx from 'clsx';
import Badge from '../common/Badge';
import CompanyLogo from '../common/CompanyLogo';
import branding from '../../config/branding';
import usePermissions from '../../hooks/usePermissions';
import { useI18n } from '../../i18n';
import { getAppointmentStats } from '../../services/appointmentService';

/* ── Icon definitions ────────────────────────────────────── */
const ICONS = {
  dashboard:    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  properties:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  customers:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  appointments: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  users:        'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  reports:      'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
};

/* ── Nav item ────────────────────────────────────────────── */
function NavItem({ item, collapsed }) {
  const { t, isRTL } = useI18n();
  const location = useLocation();
  const isActive = location.pathname === item.path ||
                   location.pathname.startsWith(item.path + '/');

  return (
    <li className="relative group">
      <NavLink
        to={item.path}
        className={clsx(
          'nav-item',
          isActive ? 'nav-item-active' : 'nav-item-default',
          collapsed && 'justify-center px-0 w-10 mx-auto'
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <svg
          className="w-5 h-5 shrink-0"
          fill="none" viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={isActive ? 2 : 1.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[item.icon]} />
        </svg>

        {!collapsed && <span className="flex-1 truncate">{t(item.labelKey)}</span>}

        {!collapsed && item.badge && (
          <Badge variant={item.badgeVariant || 'secondary'} size="sm" className="shrink-0 ms-auto">
            {item.badge}
          </Badge>
        )}
      </NavLink>

      {/* Collapsed tooltip — position relative to RTL */}
      {collapsed && (
        <div
          className={clsx(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 px-2.5 py-1.5',
            'bg-dark-800 text-white text-xs font-medium rounded-lg whitespace-nowrap',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-tooltip',
            isRTL ? 'end-full me-3' : 'start-full ms-3'
          )}
          role="tooltip"
        >
          {t(item.labelKey)}
          {/* Arrow */}
          <span className={clsx(
            'absolute top-1/2 -translate-y-1/2 border-4 border-transparent',
            isRTL ? 'start-full border-s-dark-800' : 'end-full border-e-dark-800'
          )} />
        </div>
      )}
    </li>
  );
}

/* ── Main Sidebar ────────────────────────────────────────── */
function Sidebar({ collapsed, onToggle }) {
  const { can }    = usePermissions();
  const { t, isRTL } = useI18n();
  const [pendingAppts, setPendingAppts] = useState(0);

  // Poll for pending appointment count every 60 s
  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const res = await getAppointmentStats();
        if (active) setPendingAppts(res.data?.pending ?? 0);
      } catch { /* non-critical */ }
    };
    fetchStats();
    const id = setInterval(fetchStats, 60000);
    return () => { active = false; clearInterval(id); };
  }, []);

  /* Build sections using translation keys (not final strings) so the
     label updates immediately when the language changes. */
  const NAV_SECTIONS = [
    {
      sectionKey: 'nav.main',
      items: [
        { labelKey: 'nav.dashboard',    path: '/dashboard',    icon: 'dashboard' },
      ],
    },
    {
      sectionKey: 'nav.management',
      items: [
        { labelKey: 'nav.properties',   path: '/properties',   icon: 'properties' },
        { labelKey: 'nav.customers',    path: '/customers',    icon: 'customers' },
        {
          labelKey:     'nav.appointments',
          path:         '/appointments',
          icon:         'appointments',
          badge:        pendingAppts > 0 ? String(pendingAppts) : null,
          badgeVariant: 'warning',
        },
        ...(can('manage_users')
          ? [{ labelKey: 'nav.users', path: '/users', icon: 'users' }]
          : []),
      ],
    },
    {
      sectionKey: 'nav.analytics',
      items: [
        { labelKey: 'nav.reports',      path: '/reports',      icon: 'reports' },
      ],
    },
  ];

  /* Sidebar collapse/expand arrow — mirrors in RTL */
  const collapseIcon = isRTL
    ? (collapsed
        ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7'   // point left (back toward content in LTR but RTL is reversed)
        : 'M13 5l7 7-7 7M5 5l7 7-7 7')
    : (collapsed
        ? 'M13 5l7 7-7 7M5 5l7 7-7 7'
        : 'M11 19l-7-7 7-7m8 14l-7-7 7-7');

  return (
    <aside
      className={clsx(
        'flex flex-col bg-gradient-dark text-white shrink-0 transition-all duration-300 ease-in-out border-e border-white/5',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
      aria-label="Main navigation"
    >
      {/* ── Brand / Logo ──────────────────────────────── */}
      <div className={clsx(
        'shrink-0 border-b border-white/10 transition-all duration-300',
        collapsed
          ? 'h-header flex items-center justify-center px-2'
          : 'flex flex-col items-center justify-center px-4 py-4 gap-2'
      )}>
        {collapsed ? (
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
            <img
              src="/logo.svg"
              alt={branding.companyNameShort}
              className="w-7 h-7 object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
        ) : (
          <>
            <div className="w-full flex items-center justify-center bg-white/5 rounded-xl px-3 py-2">
              <CompanyLogo variant="white" size="sm" imgClassName="max-h-10 max-w-full" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white font-arabic leading-tight">
                {branding.companyName}
              </p>
              <p className="text-2xs text-white/40 mt-0.5 leading-tight line-clamp-1 font-arabic">
                {branding.sidebarTagline}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-hide">
        {NAV_SECTIONS.map((section) => (
          <div key={section.sectionKey} className="mb-4">
            {!collapsed && (
              <p className="px-4 mb-1 text-2xs font-semibold text-white/30 uppercase tracking-widest">
                {t(section.sectionKey)}
              </p>
            )}
            {collapsed && <div className="border-t border-white/10 mx-3 mb-3" />}

            <ul className={clsx('space-y-0.5', collapsed ? 'px-1' : 'px-3')}>
              {section.items.map((item) => (
                <NavItem key={item.path} item={item} collapsed={collapsed} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Footer: version + collapse toggle ─────────── */}
      <div className={clsx(
        'border-t border-white/10 py-3 shrink-0',
        collapsed ? 'flex justify-center' : 'px-4 flex items-center justify-between'
      )}>
        {!collapsed && (
          <span className="text-2xs text-white/30">v{branding.version}</span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          aria-label={collapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={collapseIcon} />
          </svg>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
