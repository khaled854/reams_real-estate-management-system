import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams }           from 'react-router-dom';
import toast                                from 'react-hot-toast';
import clsx                                 from 'clsx';
import PageHeader             from '../../../components/common/PageHeader';
import Card                   from '../../../components/common/Card';
import Button                 from '../../../components/common/Button';
import Spinner                from '../../../components/common/Spinner';
import Modal                  from '../../../components/common/Modal';
import { ConfirmModal }       from '../../../components/common/Modal';
import AppointmentStatusBadge from '../components/AppointmentStatusBadge';
import AppointmentForm        from '../components/AppointmentForm';
import {
  getAppointment, updateAppointment, updateAppointmentStatus,
  rescheduleAppointment, deleteAppointment,
  VALID_NEXT_STATUSES,
} from '../../../services/appointmentService';
import usePermissions from '../../../hooks/usePermissions';
import { useI18n }    from '../../../i18n';

/* ── Helpers ──────────────────────────────────────────────── */
function fmtDate(d, locale = 'en-GB') {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(new Date(d));
}
function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const d = new Date(); d.setHours(+h, +m, 0);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(d, locale = 'en-GB') {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
}
function DetailRow({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-dark-50 last:border-0">
      <span className="text-sm text-dark-500">{label}</span>
      <span className={clsx('text-sm font-medium text-dark-800 text-end max-w-[60%] break-words', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

/* ── Status action buttons ────────────────────────────────── */
const ACTION_STYLES = {
  confirmed:   'btn-success',
  rejected:    'btn-danger',
  cancelled:   'btn-secondary',
  completed:   'btn-primary',
  no_show:     'btn-secondary',
  rescheduled: 'btn-info',
};
const ACTION_ICONS = {
  confirmed: '✅', rejected: '❌', cancelled: '🚫',
  completed: '✔️', no_show: '👻', rescheduled: '📅',
};

/* ── Main component ───────────────────────────────────────── */
function AppointmentDetailsPage() {
  const navigate         = useNavigate();
  const { id }           = useParams();
  const { isAdmin, can } = usePermissions();
  const { t, language }  = useI18n();
  const locale           = language === 'ar' ? 'ar-EG' : 'en-GB';

  const [appt,        setAppt]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [savingStatus,setSavingStatus]= useState(null);  // holds the status being saved
  const [showEdit,    setShowEdit]    = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [showReschedule,  setShowReschedule]  = useState(false);
  const [reschedLoading,  setReschedLoading]  = useState(false);
  const [reschedForm,     setReschedForm]     = useState({ appointment_date:'', appointment_time:'', admin_notes:'' });
  const [showDelete,  setShowDelete]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const canManage = isAdmin || can('manage_appointments');
  const canDelete = isAdmin;

  /* ── Load ─────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const apptData = await getAppointment(id);
      setAppt(apptData);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Appointment not found');
      navigate('/appointments');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (newStatus) => {
    setSavingStatus(newStatus);
    try {
      const apptData = await updateAppointmentStatus(id, newStatus);
      setAppt(apptData);
      toast.success(t(`appointments.status.${newStatus}`) || newStatus);
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.actionFailed'));
    } finally {
      setSavingStatus(null);
    }
  };

  const handleEditSave = async (formData) => {
    setEditLoading(true);
    try {
      const apptData = await updateAppointment(id, formData);
      setAppt(apptData);
      setShowEdit(false);
      toast.success(t('toast.appointmentUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.saveFailed'));
    } finally {
      setEditLoading(false);
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!reschedForm.appointment_date || !reschedForm.appointment_time) {
      toast.error(t('validation.dateRequired')); return;
    }
    setReschedLoading(true);
    try {
      const apptData = await rescheduleAppointment(id, reschedForm);
      setAppt(apptData);
      setShowReschedule(false);
      toast.success(t('toast.appointmentUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.saveFailed'));
    } finally {
      setReschedLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAppointment(id);
      toast.success(t('toast.appointmentDeleted'));
      navigate('/appointments');
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.deleteFailed'));
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner size="xl" /></div>;
  if (!appt)   return null;

  const nextStatuses = VALID_NEXT_STATUSES[appt.status] ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('appointments.appointmentDetails')}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'),    href: '/dashboard' },
          { label: t('breadcrumbs.appointments'), href: '/appointments' },
          { label: `#${appt.id}` },
        ]}
        actions={
          <div className="flex gap-2 flex-wrap">
            {canManage && (
              <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>✏️ {t('common.edit')}</Button>
            )}
            {canManage && appt.status !== 'completed' && appt.status !== 'cancelled' && appt.status !== 'rejected' && (
              <Button variant="secondary" size="sm" onClick={() => {
                setReschedForm({ appointment_date: appt.appointment_date, appointment_time: appt.appointment_time, admin_notes: '' });
                setShowReschedule(true);
              }}>
                📅 {t('appointments.actions.markRescheduled')}
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>🗑️ {t('common.delete')}</Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">

          {/* Status banner */}
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-dark-400 mb-1">{t('common.status')}</p>
                <AppointmentStatusBadge status={appt.status} size="lg" dot />
              </div>
              {canManage && nextStatuses.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {nextStatuses.map((s) => (
                    <button key={s} onClick={() => handleStatus(s)} disabled={!!savingStatus}
                      className={clsx('btn btn-sm gap-1.5', ACTION_STYLES[s] ?? 'btn-secondary', savingStatus === s && 'opacity-60 cursor-wait')}>
                      {savingStatus === s ? <span className="spinner-xs" /> : <span>{ACTION_ICONS[s]}</span>}
                      {t(`appointments.status.${s}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Appointment info */}
          <Card>
            <Card.Header>{t('appointments.appointmentDetails')}</Card.Header>
            <DetailRow label={t('common.date')}                  value={fmtDate(appt.appointment_date, locale)} />
            <DetailRow label={t('common.time')}                  value={fmtTime(appt.appointment_time)} />
            <DetailRow label={t('appointments.form.duration')}   value={`${appt.duration_minutes} ${t('appointments.duration.30').split(' ')[1] || 'min'}`} />
            <DetailRow label={t('common.type')}                  value={t(`appointments.type.${appt.type}`) || appt.type} />
            <DetailRow label={t('common.source')}                value={appt.source} />
            {appt.original_date && (
              <DetailRow label={t('common.date')} value={`${fmtDate(appt.original_date, locale)} ${fmtTime(appt.original_time)}`} />
            )}
            <DetailRow label={t('common.createdAt')}             value={fmtDateTime(appt.created_at, locale)} />
            <DetailRow label={t('common.updatedAt')}             value={fmtDateTime(appt.updated_at, locale)} />
          </Card>

          {/* Property info */}
          <Card>
            <Card.Header actions={
              <Button variant="ghost" size="sm" onClick={() => navigate(`/properties/${appt.property_id}`)}>
                {t('properties.propertyDetails')} →
              </Button>
            }>
              {t('nav.properties')}
            </Card.Header>
            <DetailRow label={t('properties.table.property')}   value={appt.property_title ?? `#${appt.property_id}`} />
            <DetailRow label={t('common.location')}             value={appt.property_location} />
            <DetailRow label={t('properties.form.listingType')} value={appt.property_listing_type} />
            <DetailRow label={t('common.status')}               value={appt.property_status ? t(`properties.status.${appt.property_status}`) : null} />
          </Card>

          {(appt.customer_notes || appt.admin_notes) && (
            <Card>
              <Card.Header>{t('appointments.form.notes')}</Card.Header>
              {appt.customer_notes && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-dark-500 uppercase mb-1">{t('appointments.form.customerNotes')}</p>
                  <p className="text-sm text-dark-700 whitespace-pre-line">{appt.customer_notes}</p>
                </div>
              )}
              {appt.admin_notes && (
                <div>
                  <p className="text-xs font-semibold text-dark-500 uppercase mb-1">
                    {t('appointments.form.adminNotes')} <span className="normal-case text-warning">{t('appointments.form.adminNotesHint')}</span>
                  </p>
                  <p className="text-sm text-dark-700 whitespace-pre-line">{appt.admin_notes}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <Card.Header>{t('nav.customers')}</Card.Header>
            <DetailRow label={t('common.name')}  value={appt.customer_name} />
            <DetailRow label={t('common.phone')} value={appt.customer_phone} />
            <DetailRow label={t('common.email')} value={appt.customer_email} />
            {appt.customer_id && (
              <div className="pt-3">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate(`/customers/${appt.customer_id}`)}>
                  {t('customers.customerDetails')} →
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <Card.Header>{t('customers.form.assignedTo')}</Card.Header>
            {appt.agent_name ? (
              <>
                <DetailRow label={t('common.name')}  value={appt.agent_name} />
                <DetailRow label={t('common.phone')} value={appt.agent_phone} />
              </>
            ) : (
              <p className="text-sm text-dark-400 py-2">{t('common.unassigned')}</p>
            )}
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} size="xl">
        <Modal.Header onClose={() => setShowEdit(false)}>{t('appointments.editAppointment')}</Modal.Header>
        <Modal.Body>
          <AppointmentForm
            initialValues={{
              customer_name: appt.customer_name, customer_phone: appt.customer_phone,
              customer_email: appt.customer_email ?? '', appointment_date: appt.appointment_date,
              appointment_time: appt.appointment_time, duration_minutes: appt.duration_minutes,
              type: appt.type, customer_notes: appt.customer_notes ?? '', admin_notes: appt.admin_notes ?? '',
            }}
            onSubmit={handleEditSave}
            loading={editLoading}
            submitLabel={t('common.save')}
          />
        </Modal.Body>
      </Modal>

      {/* Reschedule modal */}
      <Modal isOpen={showReschedule} onClose={() => setShowReschedule(false)} size="md">
        <Modal.Header onClose={() => setShowReschedule(false)}>{t('appointments.actions.markRescheduled')}</Modal.Header>
        <Modal.Body>
          <form onSubmit={handleReschedule} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1.5">{t('appointments.form.date')} *</label>
                <input type="date" className="form-input w-full" value={reschedForm.appointment_date}
                  onChange={(e) => setReschedForm((f) => ({ ...f, appointment_date: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1.5">{t('appointments.form.time')} *</label>
                <input type="time" className="form-input w-full" value={reschedForm.appointment_time}
                  onChange={(e) => setReschedForm((f) => ({ ...f, appointment_time: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1.5">{t('appointments.form.adminNotes')}</label>
              <textarea className="form-input w-full" rows={2}
                value={reschedForm.admin_notes}
                onChange={(e) => setReschedForm((f) => ({ ...f, admin_notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowReschedule(false)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={reschedLoading}>{t('common.confirm')}</Button>
            </div>
          </form>
        </Modal.Body>
      </Modal>

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t('appointments.deleteConfirm.title')}
        message={t('appointments.deleteConfirm.message')}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}

export default AppointmentDetailsPage;
