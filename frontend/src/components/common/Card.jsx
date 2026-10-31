import clsx from 'clsx';

/**
 * Card
 * Variants: default | bordered | flat | elevated | stats
 *
 * Usage:
 *   <Card>...</Card>
 *   <Card.Header>Title</Card.Header>
 *   <Card.Body>...</Card.Body>
 *   <Card.Footer>...</Card.Footer>
 *
 *   <StatsCard title="Total Properties" value="248" trend="+12%" trendUp icon={...} accent="primary" />
 */

/* ── Base Card ───────────────────────────────────────────── */
function Card({ children, variant = 'default', padding = true, className, onClick }) {
  const variantClasses = {
    default:  'card',
    bordered: 'card-bordered',
    flat:     'bg-white rounded-xl p-6',
    elevated: 'bg-white rounded-xl shadow-xl p-6',
  };

  return (
    <div
      className={clsx(
        variantClasses[variant] ?? variantClasses.default,
        !padding && '!p-0',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

/* ── Card.Header ─────────────────────────────────────────── */
function CardHeader({ children, className, actions }) {
  return (
    <div className={clsx('flex items-center justify-between mb-4', className)}>
      <div className="flex-1 min-w-0">
        {typeof children === 'string' ? (
          <h3 className="text-base font-semibold text-dark-800 truncate">{children}</h3>
        ) : (
          children
        )}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4 shrink-0">{actions}</div>}
    </div>
  );
}

/* ── Card.Body ───────────────────────────────────────────── */
function CardBody({ children, className }) {
  return <div className={clsx('flex-1', className)}>{children}</div>;
}

/* ── Card.Footer ─────────────────────────────────────────── */
function CardFooter({ children, className }) {
  return (
    <div
      className={clsx(
        'mt-4 pt-4 border-t border-dark-100 flex items-center justify-between gap-3',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── StatsCard ───────────────────────────────────────────── */
const accentMap = {
  primary:   'stat-card-primary',
  secondary: 'stat-card-secondary',
  success:   'stat-card-success',
  warning:   'stat-card-warning',
  danger:    'stat-card-danger',
};

const iconBgMap = {
  primary:   'bg-primary-100 text-primary-800',
  secondary: 'bg-secondary-100 text-secondary-600',
  success:   'bg-success-light text-success',
  warning:   'bg-warning-light text-warning',
  danger:    'bg-danger-light text-danger',
};

export function StatsCard({
  title,
  value,
  trend,
  trendUp,
  trendLabel = 'vs last month',
  icon,
  accent = 'primary',
  loading = false,
  className,
}) {
  if (loading) {
    return (
      <div className={clsx('stat-card', accentMap[accent], 'overflow-hidden', className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-7 w-32 rounded" />
            <div className="skeleton h-3 w-28 rounded" />
          </div>
          <div className="skeleton w-11 h-11 rounded-lg ml-4 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('stat-card', accentMap[accent], className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-dark-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-dark-800 leading-none">{value}</p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 text-xs font-semibold',
                  trendUp ? 'text-success' : 'text-danger'
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={trendUp ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                </svg>
                {trend}
              </span>
              <span className="text-xs text-dark-400">{trendLabel}</span>
            </div>
          )}
        </div>

        {icon && (
          <div
            className={clsx(
              'w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ml-4',
              iconBgMap[accent]
            )}
          >
            <span className="w-5 h-5">{icon}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* Attach sub-components */
Card.Header = CardHeader;
Card.Body   = CardBody;
Card.Footer = CardFooter;

export default Card;
