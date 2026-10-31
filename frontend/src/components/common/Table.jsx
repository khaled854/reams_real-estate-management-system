import clsx from 'clsx';

/**
 * Table
 * Features:
 *  - Sortable column headers
 *  - Loading skeleton state
 *  - Empty state slot
 *  - Built-in Pagination
 *  - Row selection (optional)
 *  - Striped / hover row styles
 *
 * Usage:
 *   <Table
 *     columns={[
 *       { key: 'title', label: 'Property', sortable: true },
 *       { key: 'status', label: 'Status', render: (v) => <Badge>{v}</Badge> },
 *       { key: 'price', label: 'Price', align: 'right' },
 *     ]}
 *     data={properties}
 *     loading={loading}
 *     sortKey="title"
 *     sortOrder="asc"
 *     onSort={(key) => ...}
 *     pagination={{ page: 1, total: 100, limit: 20, onChange: (p) => ... }}
 *   />
 */

/* ── Skeleton row ────────────────────────────────────────── */
// Widths are stable (not random) to avoid render-flicker
const SKELETON_WIDTHS = ['75%', '60%', '80%', '65%', '70%', '55%', '85%', '68%'];

function SkeletonRow({ cols }) {
  return (
    <tr className="border-b border-dark-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="skeleton h-4 rounded" style={{ width: SKELETON_WIDTHS[i % SKELETON_WIDTHS.length] }} />
        </td>
      ))}
    </tr>
  );
}

/* ── Sort icon ───────────────────────────────────────────── */
function SortIcon({ active, order }) {
  return (
    <span className="inline-flex flex-col ml-1.5 shrink-0">
      <svg
        className={clsx('w-2.5 h-2.5 -mb-0.5', active && order === 'asc' ? 'text-primary-800' : 'text-dark-300')}
        viewBox="0 0 10 6" fill="currentColor"
      >
        <path d="M5 0L10 6H0z" />
      </svg>
      <svg
        className={clsx('w-2.5 h-2.5', active && order === 'desc' ? 'text-primary-800' : 'text-dark-300')}
        viewBox="0 0 10 6" fill="currentColor"
      >
        <path d="M5 6L0 0h10z" />
      </svg>
    </span>
  );
}

/* ── Pagination ──────────────────────────────────────────── */
export function Pagination({ page, total, limit, onChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-dark-100">
      <p className="text-sm text-dark-500">
        Showing <span className="font-medium">{(page - 1) * limit + 1}</span>–
        <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </p>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-500
                     hover:bg-dark-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-dark-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={clsx(
                'w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors',
                p === page
                  ? 'bg-primary-800 text-white shadow-sm'
                  : 'text-dark-600 hover:bg-dark-100'
              )}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-500
                     hover:bg-dark-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Main Table ──────────────────────────────────────────── */
function Table({
  columns        = [],
  data           = [],
  loading        = false,
  skeletonRows   = 5,
  emptyTitle     = 'No records found',
  emptyMessage   = 'Try adjusting your search or filters.',
  emptyIcon,
  sortKey,
  sortOrder      = 'asc',
  onSort,
  pagination,
  stickyHeader   = false,
  className,
}) {
  return (
    <div className={clsx('table-wrapper bg-white', className)}>
      <div className={clsx('overflow-x-auto', stickyHeader && 'overflow-y-auto max-h-[600px]')}>
        <table className="table" aria-busy={loading}>
          <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={clsx(
                    col.align === 'center' && 'text-center',
                    col.align === 'right'  && 'text-right',
                    col.sortable && 'cursor-pointer hover:text-dark-700 hover:bg-dark-100/60 select-none',
                    col.className
                  )}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  aria-sort={
                    col.sortable && sortKey === col.key
                      ? sortOrder === 'asc' ? 'ascending' : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.sortable && (
                      <SortIcon
                        active={sortKey === col.key}
                        order={sortOrder}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    {emptyIcon ?? (
                      <svg className="w-12 h-12 text-dark-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    )}
                    <p className="text-base font-semibold text-dark-600">{emptyTitle}</p>
                    <p className="text-sm text-dark-400 mt-1 max-w-xs">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row.id ?? rowIndex}
                  className={clsx(row.onClick && 'cursor-pointer')}
                  onClick={row.onClick}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        col.align === 'center' && 'text-center',
                        col.align === 'right'  && 'text-right',
                        col.tdClassName
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && !loading && data.length > 0 && (
        <Pagination {...pagination} />
      )}
    </div>
  );
}

export default Table;
