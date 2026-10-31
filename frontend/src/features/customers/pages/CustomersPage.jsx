import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import PageHeader from '../../../components/common/PageHeader';
import Button from '../../../components/common/Button';
import Spinner from '../../../components/common/Spinner';
import { ConfirmModal } from '../../../components/common/Modal';
import { Pagination } from '../../../components/common/Table';
import CustomerCard from '../components/CustomerCard';
import CustomerFilters from '../components/CustomerFilters';
import CustomerStatusBadge from '../components/CustomerStatusBadge';
import { useCustomers } from '../hooks/useCustomers';
import usePermissions from '../../../hooks/usePermissions';
import { useI18n } from '../../../i18n';

/* ── Pipeline KPI card ────────────────────────────────────── */
function PipelineCard({ label, count, color }) {
  return (
    <div className={clsx('bg-white rounded-xl border-l-4 px-4 py-3 shadow-xs', color)}>
      <p className="text-2xl font-bold text-dark-800">{count}</p>
      <p className="text-xs text-dark-500 mt-0.5">{label}</p>
    </div>
  );
}

/* ── View toggle ──────────────────────────────────────────── */
function ViewToggle({ view, setView }) {
  return (
    <div className="flex items-center gap-1 bg-dark-100 rounded-lg p-1">
      {[
        { key: 'grid', path: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
        { key: 'list', path: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z' },
      ].map(({ key, path }) => (
        <button key={key} onClick={() => setView(key)}
          className={clsx('p-1.5 rounded-md transition-colors',
            view === key ? 'bg-white text-primary-800 shadow-xs' : 'text-dark-500 hover:text-dark-700')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={path} />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ── Table row ────────────────────────────────────────────── */
function TableRow({ customer, onDelete, deleting }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { t, language } = useI18n();
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';
  function fmtBudget(n) {
    if (!n) return '—';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(n);
  }
  return (
    <tr className="border-b border-dark-50 hover:bg-primary-50/30 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-dark-800 cursor-pointer hover:text-primary-800"
            onClick={() => navigate(`/customers/${customer.id}`)}>
            {customer.name}
          </p>
          <p className="text-xs text-dark-400">{customer.phone}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-dark-600">{customer.email || '—'}</td>
      <td className="px-4 py-3 text-sm text-dark-600">{customer.property_type || '—'}</td>
      <td className="px-4 py-3 text-sm text-dark-600">{customer.location || '—'}</td>
      <td className="px-4 py-3 text-sm text-dark-600">{fmtBudget(customer.budget)}</td>
      <td className="px-4 py-3"><CustomerStatusBadge status={customer.status} size="sm" /></td>
      <td className="px-4 py-3 text-sm text-dark-500">{customer.employee_name || '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate(`/customers/${customer.id}`)} className="btn-ghost btn-xs">{t('common.view')}</button>
          {can('create_customer') && (
            <button onClick={() => navigate(`/customers/${customer.id}/edit`)} className="btn-outline btn-xs">{t('common.edit')}</button>
          )}
          {can('delete_customer') && (
            <button onClick={() => onDelete(customer.id)} disabled={deleting} className="btn-danger btn-xs">
              {deleting ? '…' : t('common.delete')}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Main page ────────────────────────────────────────────── */
function CustomersPage() {
  const navigate    = useNavigate();
  const { can }     = usePermissions();
  const { t }       = useI18n();
  const [view,      setView]      = useState('list');
  const [confirmId, setConfirmId] = useState(null);

  const {
    customers, meta, filters, loading, deletingId,
    pipelineCount, totalCustomers,
    setFilter, resetFilters, setPage, setSort,
    handleDelete,
  } = useCustomers();

  const doDelete = async () => {
    await handleDelete(confirmId);
    setConfirmId(null);
  };

  const PIPELINE_STAGES = [
    { status: 'new',         color: 'border-info' },
    { status: 'contacted',   color: 'border-primary-800' },
    { status: 'interested',  color: 'border-warning' },
    { status: 'negotiating', color: 'border-secondary-500' },
    { status: 'closed',      color: 'border-success' },
    { status: 'lost',        color: 'border-danger' },
  ];

  const TABLE_COLS = [
    { key: 'name',          label: t('customers.table.customer'),    sortable: true },
    { key: 'email',         label: t('customers.table.email') },
    { key: 'property_type', label: t('customers.table.interestedIn') },
    { key: 'location',      label: t('customers.table.location') },
    { key: 'budget',        label: t('customers.table.budget'),      sortable: true },
    { key: 'status',        label: t('customers.table.status'),      sortable: true },
    { key: 'employee',      label: t('customers.table.assignedTo') },
    { key: 'actions',       label: '' },
  ];

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        subtitle={`${totalCustomers} ${totalCustomers !== 1 ? t('customers.customerPlural') : t('customers.customer')} ${t('customers.total')}`}
        breadcrumbs={[{ label: t('breadcrumbs.dashboard'), href: '/dashboard' }, { label: t('breadcrumbs.customers') }]}
        actions={
          <div className="flex items-center gap-3">
            <ViewToggle view={view} setView={setView} />
            {can('create_customer') && (
              <Button
                onClick={() => navigate('/customers/new')}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                }
              >
                {t('customers.addCustomer')}
              </Button>
            )}
          </div>
        }
      />

      {/* Pipeline KPI bar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        {PIPELINE_STAGES.map((s) => (
          <PipelineCard
            key={s.status}
            label={t(`customers.status.${s.status}`)}
            count={pipelineCount(s.status)}
            color={s.color}
          />
        ))}
      </div>

      <CustomerFilters filters={filters} setFilter={setFilter} resetFilters={resetFilters} />

      {/* Content */}
      {loading && customers.length === 0 ? (
        <div className="flex items-center justify-center py-24"><Spinner size="xl" /></div>
      ) : customers.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-primary-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-dark-700">{t('customers.noCustomers')}</p>
          <p className="text-sm text-dark-400 mt-1">{t('customers.noCustomersHint')}</p>
          {can('create_customer') && (
            <Button onClick={() => navigate('/customers/new')} className="mt-5" size="sm">
              {t('customers.addFirst')}
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <>
          <div className={clsx(
            'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
            loading && 'opacity-60 pointer-events-none'
          )}>
            {customers.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                onDelete={(id) => setConfirmId(id)}
                deleting={deletingId === c.id}
              />
            ))}
          </div>
          {meta.totalPages > 1 && (
            <div className="mt-6">
              <Pagination page={meta.page} total={meta.total} limit={meta.limit} onChange={setPage} />
            </div>
          )}
        </>
      ) : (
        <div className="table-wrapper bg-white">
          <table className="table">
            <thead>
              <tr>
                {TABLE_COLS.map((col) => (
                  <th key={col.key}
                    className={clsx(col.sortable && 'cursor-pointer hover:bg-dark-100/60 select-none')}
                    onClick={() => col.sortable && setSort(col.key)}>
                    {col.label}
                    {col.sortable && filters.sort === col.key && (
                      <span className="ms-1 text-primary-800">{filters.order === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <TableRow
                  key={c.id}
                  customer={c}
                  onDelete={(id) => setConfirmId(id)}
                  deleting={deletingId === c.id}
                />
              ))}
            </tbody>
          </table>
          {meta.totalPages > 1 && (
            <Pagination page={meta.page} total={meta.total} limit={meta.limit} onChange={setPage} />
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={doDelete}
        title={t('customers.deleteConfirm.title')}
        message={t('customers.deleteConfirm.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        loading={deletingId !== null}
      />
    </div>
  );
}

export default CustomersPage;
