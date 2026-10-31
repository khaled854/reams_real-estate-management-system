import clsx from 'clsx';

/**
 * PageHeader
 * Renders the top section of a page:
 * - title + optional subtitle
 * - optional breadcrumb
 * - optional right-side actions slot
 *
 * Usage:
 *   <PageHeader
 *     title="Properties"
 *     subtitle="Manage all property listings"
 *     actions={<Button>Add Property</Button>}
 *     breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Properties' }]}
 *   />
 */
function PageHeader({ title, subtitle, actions, breadcrumbs, className }) {
  return (
    <div className={clsx('mb-6', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-xs text-dark-400">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center gap-1.5">
                {index > 0 && (
                  <svg className="w-3 h-3 text-dark-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-primary-800 transition-colors">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-dark-600 font-medium">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-3 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
