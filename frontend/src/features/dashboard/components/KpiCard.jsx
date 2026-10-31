import clsx from 'clsx';

/**
 * KpiCard
 * Premium stat card with left accent bar, icon, value, label, and optional trend.
 *
 * Props:
 *   title     — metric label
 *   value     — formatted display value
 *   icon      — SVG path string (d attribute)
 *   accent    — primary | secondary | success | warning | danger | info
 *   trend     — optional string e.g. "+12%"
 *   trendUp   — boolean
 *   loading   — shows skeleton
 *   onClick   — optional click handler
 */

const ACCENT = {
  primary:   { bar: 'bg-primary-800',   icon: 'bg-primary-100 text-primary-800' },
  secondary: { bar: 'bg-secondary-500', icon: 'bg-secondary-100 text-secondary-600' },
  success:   { bar: 'bg-success',       icon: 'bg-success-light text-success' },
  warning:   { bar: 'bg-warning',       icon: 'bg-warning-light text-warning' },
  danger:    { bar: 'bg-danger',        icon: 'bg-danger-light text-danger' },
  info:      { bar: 'bg-info',          icon: 'bg-info-light text-info' },
};

function KpiCard({ title, value, icon, accent = 'primary', trend, trendUp, loading, onClick, className }) {
  const colors = ACCENT[accent] ?? ACCENT.primary;

  if (loading) {
    return (
      <div className={clsx('bg-white rounded-xl shadow-card border border-dark-100 p-5 relative overflow-hidden', className)}>
        <div className={clsx('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', colors.bar)} />
        <div className="pl-2 flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="skeleton h-3 w-28 rounded" />
            <div className="skeleton h-8 w-20 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
          <div className="skeleton w-11 h-11 rounded-xl ml-4 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-card border border-dark-100 p-5 relative overflow-hidden',
        'transition-all duration-200 hover:shadow-card-hover',
        onClick && 'cursor-pointer hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      {/* Left accent bar */}
      <div className={clsx('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', colors.bar)} />

      <div className="pl-3 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-dark-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-dark-800 leading-none tracking-tight">{value ?? '—'}</p>
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className={clsx(
                'inline-flex items-center gap-0.5 text-xs font-semibold',
                trendUp ? 'text-success' : 'text-danger'
              )}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={trendUp ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                </svg>
                {trend}
              </span>
              <span className="text-xs text-dark-400">vs last month</span>
            </div>
          )}
        </div>

        {icon && (
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-4', colors.icon)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export default KpiCard;
