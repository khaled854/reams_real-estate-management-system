import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import PageHeader            from '../../../components/common/PageHeader';
import Card                  from '../../../components/common/Card';
import Button                from '../../../components/common/Button';
import Spinner               from '../../../components/common/Spinner';
import Badge                 from '../../../components/common/Badge';
import { ConfirmModal }      from '../../../components/common/Modal';
import { Pagination }        from '../../../components/common/Table';
import AppointmentStatusBadge from '../components/AppointmentStatusBadge';
import AppointmentFilters    from '../components/AppointmentFilters';
import { useAppointments }   from '../hooks/useAppointments';
import usePermissions        from '../../../hooks/usePermissions';
import { VALID_NEXT_STATUSES } from '../../../services/appointmentService';
import { useI18n }           from '../../../i18n';

/* ── Stat card ────────────────────────────────────────────── */
function StatCard({ label, value, color, onClick }) {
  return (
    <div
      className={clsx('bg-white rounded-xl border-l-4 px-4 py-3 shadow-xs cursor-pointer hover:shadow-sm transition-shadow', color)}
      onClick={onClick}
    >
      <p className="text-2xl font-bold text-dark-800">{value ?? '–'}</p>
      <p className="text-xs text-dark-500 mt-0.5">{label}</p>
    </div>
  );
}

/* ── Format helpers ───────────────────────────────────────── */
function fmtDate(d, locale = 'en-GB') {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(d));
}
function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const d = new Date(); d.setHours(+h, +m, 0);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/* ── Quick-action menu ────────────────────────────────────── */
function ActionMenu({ appt, onStatus, onDelete, canDelete }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const next = VALID_NEXT_STATUSES[appt.status] ?? [];

  const STATUS_ICONS = {
    confirmed: '✅', rejected: '❌', cancelled: '🚫',
    completed: '✔️', no_show:  '👻', rescheduled: '📅',
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="p-1.5 rounded-lg text-dark-500 hover:bg-dark-100 transition-colors" aria-label={t('common.actions')}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute end-0 top-8 w-52 bg-white rounded-xl shadow-xl border border-dark-100 z-10 py-1">
          {next.map((s) => (
            <button key={s}
              className="w-full text-start px-4 py-2 text-sm text-dark-700 hover:bg-primary-50 flex items-center gap-2"
              onClick={() => { onStatus(appt.id, s); setOpen(false); }}>
              <span>{STATUS_ICONS[s] ?? '→'}</span>
              <span>{t(`appointments.actions.mark${s.charAt(0).toUpperCase()}${s.slice(1).replace('_show','NoShow').replace('_','')}`) || t(`appointments.status.${s}`)}</span>
            </button>
          ))}
          {next.length > 0 && canDelete && <hr className="my-1 border-dark-100" />}
          {canDelete && (
            <button className="w-full text-start px-4 py-2 text-sm text-danger hover:bg-danger-light flex items-center gap-2"
              onClick={() => { onDelete(appt.id); setOpen(false); }}>
              <span>🗑️</span><span>{t('common.delete')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */
function AppointmentsPage() {
  const navigate = useNavigate();
  const { can, isAdmin } = usePermissions();
  const { t, language } = useI18n();
  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';
  const {
    appointments, meta, stats, filters, loading,
    deletingId, setFilter, resetFilters, changeStatus, remove,
  } = useAppointments();

  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleStatus = async (id, status) => {
    try { await changeStatus(id, status); }
    catch { /* toast shown inside hook */ }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('appointments.title')}
        subtitle={t('appointments.subtitle')}
        breadcrumbs={[{ label: t('breadcrumbs.dashboard'), href: '/dashboard' }, { label: t('breadcrumbs.appointments') }]}
        actions={
          can('create_appointment') && (
            <Button onClick={() => navigate('/appointments/new')} size="sm">
              + {t('appointments.addAppointment')}
            </Button>
          )
        }
      />

      {/* ── KPI strip ────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label={t('common.total')}                     value={stats.total}     color="border-dark-300"    onClick={() => resetFilters()} />
          <StatCard label={t('appointments.stats.pending')}       value={stats.pending}   color="border-warning"     onClick={() => setFilter('status','pending')} />
          <StatCard label={t('appointments.stats.confirmed')}     value={stats.confirmed} color="border-success"     onClick={() => setFilter('status','confirmed')} />
          <StatCard label={t('appointments.stats.today')}         value={stats.today}     color="border-primary-800" onClick={() => setFilter('date_from', new Date().toISOString().split('T')[0])} />
          <StatCard label={t('appointments.stats.upcoming')}      value={stats.upcoming}  color="border-info"        onClick={() => setFilter('status','confirmed')} />
          <StatCard label={t('appointments.stats.completed')}     value={stats.completed} color="border-primary-400" onClick={() => setFilter('status','completed')} />
          <StatCard label={t('appointments.stats.cancelled')}     value={stats.cancelled} color="border-dark-200"    onClick={() => setFilter('status','cancelled')} />
        </div>
      )}

      <AppointmentFilters filters={filters} setFilter={setFilter} resetFilters={resetFilters} />

      <Card padding={false}>
        <div className="px-5 py-4 border-b border-dark-50 flex items-center justify-between">
          <h3 className="text-base font-semibold text-dark-800">
            {t('appointments.title')}
            {meta.total > 0 && (
              <span className="ms-2 text-xs text-dark-400 font-normal">({meta.total} {t('common.total').toLowerCase()})</span>
            )}
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 text-dark-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-dark-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">{t('appointments.noAppointments')}</p>
            <p className="text-xs mt-1">{t('appointments.noAppointmentsHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-100 bg-dark-25">
                  {[
                    t('appointments.table.customer'),
                    t('appointments.table.property'),
                    t('appointments.table.dateTime'),
                    t('appointments.table.type'),
                    t('appointments.table.status'),
                    t('appointments.table.agent'),
                    t('appointments.table.actions'),
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-dark-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id} className="border-b border-dark-50 hover:bg-primary-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-800">{appt.customer_name}</p>
                      <p className="text-xs text-dark-400">{appt.customer_phone}</p>
                      {appt.customer_email && <p className="text-xs text-dark-400 truncate max-w-[160px]">{appt.customer_email}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-dark-700 truncate">{appt.property_title ?? `#${appt.property_id}`}</p>
                      {appt.property_location && <p className="text-xs text-dark-400 truncate">{appt.property_location}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-dark-800">{fmtDate(appt.appointment_date, locale)}</p>
                      <p className="text-xs text-dark-500">{fmtTime(appt.appointment_time)}</p>
                      {appt.original_date && (
                        <p className="text-xs text-warning mt-0.5">{fmtDate(appt.original_date, locale)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" size="sm">
                        {t(`appointments.type.${appt.type}`) || appt.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3"><AppointmentStatusBadge status={appt.status} dot /></td>
                    <td className="px-4 py-3"><p className="text-dark-700 text-xs">{appt.agent_name ?? '—'}</p></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/appointments/${appt.id}`)}
                          className="p-1.5 text-dark-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                          title={t('common.view')}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <ActionMenu appt={appt} onStatus={handleStatus} onDelete={(id) => setDeleteTarget(id)} canDelete={isAdmin || can('delete_appointment')} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-dark-50">
            <Pagination page={meta.page} total={meta.total} limit={meta.limit} onChange={(p) => setFilter('page', p)} />
          </div>
        )}
      </Card>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('appointments.deleteConfirm.title')}
        message={t('appointments.deleteConfirm.message')}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
        loading={deletingId === deleteTarget}
      />
    </div>
  );
}

export default AppointmentsPage;
