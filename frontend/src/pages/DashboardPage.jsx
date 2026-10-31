import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import useAuthStore from '../store/authStore';
import usePermissions from '../hooks/usePermissions';
import { useDashboard } from '../features/dashboard/hooks/useDashboard';
import KpiCard from '../features/dashboard/components/KpiCard';
import MonthlyTrendChart from '../features/dashboard/components/MonthlyTrendChart';
import PropertyStatusChart from '../features/dashboard/components/PropertyStatusChart';
import PropertyTypeChart from '../features/dashboard/components/PropertyTypeChart';
import CustomerStatusChart from '../features/dashboard/components/CustomerStatusChart';
import ActivityFeed from '../features/dashboard/components/ActivityFeed';
import AppointmentWidget from '../features/dashboard/components/AppointmentWidget';
import { useI18n } from '../i18n';

/* ── Reusable icon paths ──────────────────────────────────── */
const ICONS = {
  building:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  check:      'M4.5 12.75l6 6 9-13.5',
  tag:        'M9 14.25l6-6m4.5-3.493V21.75l-4.125-1.65a4.5 4.5 0 00-1.65-.32H8.25a4.5 4.5 0 00-4.5 4.5v3m16.5 0h-16.5',
  users:      'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  home:       'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  contract:   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  money:      'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

/* ── Quick link card ──────────────────────────────────────── */
function QuickLink({ label, href, icon, color }) {
  const navigate = useNavigate();
  const { isRTL } = useI18n();
  return (
    <button
      onClick={() => navigate(href)}
      className="flex items-center gap-3 p-3.5 rounded-xl border border-dark-100 bg-white hover:bg-primary-50 hover:border-primary-200 transition-all duration-200 text-start group w-full"
    >
      <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <span className="text-sm font-medium text-dark-700 group-hover:text-primary-800 transition-colors flex-1">
        {label}
      </span>
      <svg
        className={clsx('w-4 h-4 text-dark-300 ms-auto group-hover:text-primary-800 transition-colors', isRTL && 'rotate-180')}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/* ── Main DashboardPage ───────────────────────────────────── */
function DashboardPage() {
  const navigate         = useNavigate();
  const user             = useAuthStore((s) => s.user);
  const { isAdmin, can } = usePermissions();
  const { kpis, propReport, custReport, apptStats, loading } = useDashboard();
  const { t } = useI18n();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.greetings.morning');
    if (h < 17) return t('dashboard.greetings.afternoon');
    return t('dashboard.greetings.evening');
  })();

  /* ── Safe getters ────────────────────────────────────────── */
  const k = kpis ?? {};
  // Total properties from the KPI snapshot (authoritative)
  const totalProps = Number(k.available_properties ?? 0)
    + Number(k.rented_properties ?? 0)
    + Number(k.sold_properties ?? 0);

  // Total customers from KPI snapshot (avoids divergence with report sum)
  const totalCustomers = Number(k.total_customers ?? 0) ||
    (custReport?.byStatus ?? []).reduce((s, r) => s + Number(r.count), 0);

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-dark-400 font-medium">{greeting},</p>
          <h1 className="text-2xl font-bold text-dark-800 mt-0.5">{user?.name ?? t('auth.welcome')} 👋</h1>
          <p className="text-sm text-dark-500 mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {can('create_property') && (
            <button onClick={() => navigate('/properties/new')} className="btn-primary btn-sm gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('dashboard.addProperty')}
            </button>
          )}
          {can('create_customer') && (
            <button onClick={() => navigate('/customers/new')} className="btn-secondary btn-sm gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('dashboard.addCustomer')}
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={t('dashboard.kpis.totalProperties')}  value={loading ? null : totalProps}                      icon={ICONS.building} accent="primary"   loading={loading} onClick={() => navigate('/properties')} />
        <KpiCard title={t('dashboard.kpis.available')}        value={loading ? null : k.available_properties ?? 0}     icon={ICONS.home}     accent="success"   loading={loading} onClick={() => navigate('/properties?status=available')} />
        <KpiCard title={t('dashboard.kpis.sold')}             value={loading ? null : k.sold_properties ?? 0}          icon={ICONS.check}    accent="info"      loading={loading} onClick={() => navigate('/properties?status=sold')} />
        <KpiCard title={t('dashboard.kpis.rented')}           value={loading ? null : k.rented_properties ?? 0}        icon={ICONS.tag}      accent="secondary" loading={loading} onClick={() => navigate('/properties?status=rented')} />
      </div>

      {/* ── Second KPI row ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={t('dashboard.kpis.totalCustomers')}  value={loading ? null : totalCustomers}              icon={ICONS.users}    accent="primary"   loading={loading} onClick={() => navigate('/customers')} />
        <KpiCard title={t('dashboard.kpis.newLeads')}        value={loading ? null : k.new_customers ?? 0}        icon={ICONS.users}    accent="warning"   loading={loading} onClick={() => navigate('/customers?status=new')} />
        <KpiCard title={t('dashboard.kpis.activeContracts')} value={loading ? null : k.active_contracts ?? 0}     icon={ICONS.contract} accent="info"      loading={loading} />
        {isAdmin && (
          <KpiCard
            title={t('dashboard.kpis.revenueThisMonth')}
            value={loading ? null : new Intl.NumberFormat('en-US', {
              style: 'currency', currency: 'SAR', minimumFractionDigits: 0, notation: 'compact',
            }).format(k.revenue_this_month ?? 0)}
            icon={ICONS.money}
            accent="success"
            loading={loading}
          />
        )}
      </div>

      {/* ── Charts row 1 ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Card className="xl:col-span-3" padding={false}>
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-dark-800">{t('dashboard.charts.growthTrend')}</h3>
              <p className="text-xs text-dark-400 mt-0.5">{t('dashboard.charts.growthSubtitle')}</p>
            </div>
          </div>
          <div className="px-4 pb-5">
            <MonthlyTrendChart propMonthly={propReport?.monthly} custMonthly={custReport?.monthly} loading={loading} />
          </div>
        </Card>

        <Card className="xl:col-span-2" padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">{t('dashboard.charts.propByStatus')}</h3>
            <p className="text-xs text-dark-400 mt-0.5">{t('dashboard.charts.propByStatusSub')}</p>
          </div>
          <div className="px-4 pb-5">
            <PropertyStatusChart byStatus={propReport?.byStatus} loading={loading} />
          </div>
        </Card>
      </div>

      {/* ── Charts row 2 ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Card className="xl:col-span-3" padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">{t('dashboard.charts.propByType')}</h3>
            <p className="text-xs text-dark-400 mt-0.5">{t('dashboard.charts.propByTypeSub')}</p>
          </div>
          <div className="px-4 pb-5">
            <PropertyTypeChart byType={propReport?.byType} loading={loading} />
          </div>
        </Card>

        <Card className="xl:col-span-2" padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">{t('dashboard.charts.crmPipeline')}</h3>
            <p className="text-xs text-dark-400 mt-0.5">{t('dashboard.charts.crmPipelineSub')}</p>
          </div>
          <div className="px-4 pb-5">
            <CustomerStatusChart byStatus={custReport?.byStatus} loading={loading} />
          </div>
        </Card>
      </div>

      {/* ── Appointment widget ──────────────────────────────── */}
      <AppointmentWidget stats={apptStats} loading={loading} />

      {/* ── Bottom row: activity + quick links ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2" padding={false}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-dark-50">
            <div>
              <h3 className="text-base font-semibold text-dark-800">{t('dashboard.recentActivity')}</h3>
              <p className="text-xs text-dark-400 mt-0.5">{t('dashboard.recentActivitySub')}</p>
            </div>
          </div>
          <div className="px-5 py-4">
            <ActivityFeed limit={12} />
          </div>
        </Card>

        <div className="space-y-5">
          <Card padding={false}>
            <div className="px-5 pt-5 pb-3 border-b border-dark-50">
              <h3 className="text-base font-semibold text-dark-800">{t('dashboard.quickActions')}</h3>
            </div>
            <div className="p-3 space-y-1.5">
              <QuickLink label={t('dashboard.allProperties')}   href="/properties"     icon={ICONS.building}  color="bg-primary-100 text-primary-800" />
              <QuickLink label={t('dashboard.allCustomers')}    href="/customers"      icon={ICONS.users}     color="bg-secondary-100 text-secondary-600" />
              <QuickLink label={t('dashboard.appointments')}    href="/appointments"   icon={ICONS.contract}  color="bg-info-light text-info" />
              {can('create_property') && (
                <QuickLink label={t('dashboard.addProperty')}   href="/properties/new" icon={ICONS.home}      color="bg-success-light text-success" />
              )}
              {can('create_customer') && (
                <QuickLink label={t('dashboard.addCustomer')}   href="/customers/new"  icon={ICONS.users}     color="bg-warning-light text-warning" />
              )}
              {can('view_reports') && (
                <QuickLink label={t('dashboard.viewReports')}   href="/reports"        icon={ICONS.contract}  color="bg-info-light text-info" />
              )}
            </div>
          </Card>

          <Card padding={false}>
            <div className="px-5 pt-4 pb-3 border-b border-dark-50">
              <h3 className="text-sm font-semibold text-dark-800">{t('dashboard.charts.listingTypeSplit')}</h3>
            </div>
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map((i) => <div key={i} className="skeleton h-4 rounded" />)}
                </div>
              ) : (
                (propReport?.byListingType ?? []).map((row) => {
                  const total = (propReport?.byListingType ?? []).reduce((s,r) => s + Number(r.count), 0) || 1;
                  const pct = Math.round((Number(row.count) / total) * 100);
                  const labelKey = { sale: 'dashboard.charts.forSale', rent: 'dashboard.charts.forRent', both: 'dashboard.charts.saleAndRent' };
                  const colors = { sale: 'bg-primary-800', rent: 'bg-secondary-500', both: 'bg-success' };
                  return (
                    <div key={row.listing_type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-dark-600 font-medium">{t(labelKey[row.listing_type] ?? row.listing_type)}</span>
                        <span className="text-dark-500">{row.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-dark-100 rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all duration-700', colors[row.listing_type] ?? 'bg-dark-400')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
