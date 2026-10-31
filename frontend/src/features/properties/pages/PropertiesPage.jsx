import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import PageHeader from '../../../components/common/PageHeader';
import Button from '../../../components/common/Button';
import Spinner from '../../../components/common/Spinner';
import { ConfirmModal } from '../../../components/common/Modal';
import { Pagination } from '../../../components/common/Table';
import PropertyCard from '../components/PropertyCard';
import PropertyFilters from '../components/PropertyFilters';
import PropertyStatusBadge from '../components/PropertyStatusBadge';
import { useProperties } from '../hooks/useProperties';
import usePermissions from '../../../hooks/usePermissions';
import { getImageUrl } from '../../../utils/imageUrl';
import { useI18n } from '../../../i18n';

/* ── View toggle ──────────────────────────────────────────── */
function ViewToggle({ view, setView }) {
  return (
    <div className="flex items-center gap-1 bg-dark-100 rounded-lg p-1">
      {[
        { key: 'grid', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
        { key: 'list', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z' },
      ].map(({ key, icon }) => (
        <button key={key} onClick={() => setView(key)}
          className={clsx('p-1.5 rounded-md transition-colors', view === key ? 'bg-white text-primary-800 shadow-xs' : 'text-dark-500 hover:text-dark-700')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ── Table row ────────────────────────────────────────────── */
function TableRow({ property, onEdit, onDelete, deleting }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { t, language } = useI18n();
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';

  function fmtPrice(n) {
    if (!n && n !== 0) return '—';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(n);
  }

  return (
    <tr className="border-b border-dark-50 hover:bg-primary-50/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-dark-100 overflow-hidden shrink-0">
            {property.cover_image ? (
              <img src={getImageUrl(property.cover_image)} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-5 h-5 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" /></svg>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-dark-800 truncate max-w-[220px] cursor-pointer hover:text-primary-800"
              onClick={() => navigate(`/properties/${property.id}`)}>
              {property.title}
            </p>
            <p className="text-xs text-dark-400 truncate">{property.location}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-dark-600">{property.type}</td>
      <td className="px-4 py-3"><PropertyStatusBadge status={property.status} size="sm" /></td>
      <td className="px-4 py-3 text-sm text-dark-600">{property.area} m²</td>
      <td className="px-4 py-3 text-sm font-semibold text-primary-800">{fmtPrice(property.price)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/properties/${property.id}`)} className="btn-ghost btn-xs">{t('common.view')}</button>
          {can('edit_own_property') && (
            <button onClick={() => onEdit(property.id)} className="btn-outline btn-xs">{t('common.edit')}</button>
          )}
          {can('delete_property') && (
            <button onClick={() => onDelete(property.id)} disabled={deleting} className="btn-danger btn-xs">{t('common.delete')}</button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Main page ────────────────────────────────────────────── */
function PropertiesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { t } = useI18n();
  const [view,      setView]      = useState('grid');
  const [confirmId, setConfirmId] = useState(null);

  const {
    properties, meta, filters, types, loading, deletingId,
    setFilter, resetFilters, setPage, setSort, handleDelete,
  } = useProperties();

  const confirmDelete = (id) => setConfirmId(id);
  const doDelete = async () => {
    await handleDelete(confirmId);
    setConfirmId(null);
  };

  const TABLE_COLS = [
    { key: 'title',   label: t('properties.table.property'), sortable: true },
    { key: 'type',    label: t('properties.table.type') },
    { key: 'status',  label: t('properties.table.status') },
    { key: 'area',    label: t('properties.table.area'),  sortable: true },
    { key: 'price',   label: t('properties.table.price'), sortable: true },
    { key: 'actions', label: '' },
  ];

  const total = meta.total;

  return (
    <div>
      <PageHeader
        title={t('properties.title')}
        subtitle={`${total} ${total !== 1 ? t('properties.listingsPlural') : t('properties.listings')} ${t('properties.total')}`}
        breadcrumbs={[{ label: t('breadcrumbs.dashboard'), href: '/dashboard' }, { label: t('breadcrumbs.properties') }]}
        actions={
          <div className="flex items-center gap-3">
            <ViewToggle view={view} setView={setView} />
            {can('create_property') && (
              <Button
                onClick={() => navigate('/properties/new')}
                leftIcon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
              >
                {t('properties.addProperty')}
              </Button>
            )}
          </div>
        }
      />

      <PropertyFilters filters={filters} setFilter={setFilter} resetFilters={resetFilters} types={types} />

      {loading && properties.length === 0 ? (
        <div className="flex items-center justify-center py-24"><Spinner size="xl" /></div>
      ) : properties.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-primary-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-base font-semibold text-dark-700">{t('properties.noProperties')}</p>
          <p className="text-sm text-dark-400 mt-1">{t('properties.noPropertiesHint')}</p>
          {can('create_property') && (
            <Button onClick={() => navigate('/properties/new')} className="mt-5" size="sm">
              {t('properties.addFirst')}
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <>
          <div className={clsx('grid gap-5', loading && 'opacity-60 pointer-events-none', 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}>
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} onDelete={confirmDelete} deleting={deletingId === p.id} />
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
              {properties.map((p) => (
                <TableRow key={p.id} property={p} onEdit={(id) => navigate(`/properties/${id}/edit`)} onDelete={confirmDelete} deleting={deletingId === p.id} />
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
        title={t('properties.deleteConfirm.title')}
        message={t('properties.deleteConfirm.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        loading={deletingId !== null}
      />
    </div>
  );
}

export default PropertiesPage;
