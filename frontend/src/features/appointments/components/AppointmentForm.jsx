import { useState, useEffect } from 'react';
import Input    from '../../../components/common/Input';
import Select   from '../../../components/common/Select';
import Button   from '../../../components/common/Button';
import { APPOINTMENT_TYPES } from '../../../services/appointmentService';
import { useI18n } from '../../../i18n';

const DURATION_VALUES = [30, 45, 60, 90, 120];

// eslint-disable-next-line react-refresh/only-export-components
export const EMPTY_APPOINTMENT_FORM = {
  customer_name:    '',
  customer_phone:   '',
  customer_email:   '',
  appointment_date: '',
  appointment_time: '',
  duration_minutes: 60,
  type:             'viewing',
  customer_notes:   '',
  admin_notes:      '',
};

function validate(form, t) {
  const errors = {};
  if (!form.customer_name?.trim())   errors.customer_name    = t('validation.nameRequired');
  if (!form.customer_phone?.trim())  errors.customer_phone   = t('validation.phoneRequired');
  if (form.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email)) {
    errors.customer_email = t('validation.invalidEmail');
  }
  if (!form.appointment_date)        errors.appointment_date = t('validation.dateRequired');
  if (!form.appointment_time)        errors.appointment_time = t('validation.timeRequired');
  if (form.appointment_date) {
    // Compare YYYY-MM-DD strings directly to avoid UTC/local timezone shifts
    const todayStr = new Date().toLocaleDateString('en-CA'); // returns YYYY-MM-DD in local TZ
    if (form.appointment_date < todayStr) {
      errors.appointment_date = t('validation.pastDate');
    }
  }
  return errors;
}

function AppointmentForm({
  initialValues = EMPTY_APPOINTMENT_FORM,
  onSubmit,
  loading        = false,
  submitLabel,
  showAdminNotes = true,
}) {
  const { t } = useI18n();
  const [form,   setForm]   = useState(initialValues);
  const [errors, setErrors] = useState({});

  useEffect(() => { setForm(initialValues); }, [JSON.stringify(initialValues)]); // eslint-disable-line

  const TYPE_OPTIONS     = APPOINTMENT_TYPES.map((tp) => ({ value: tp, label: t(`appointments.type.${tp}`) || tp }));
  const DURATION_OPTIONS = DURATION_VALUES.map((v) => ({ value: v, label: t(`appointments.duration.${v}`) || `${v}m` }));

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(form, t);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit({ ...form });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">

      {/* Customer info */}
      <div>
        <h3 className="text-sm font-semibold text-dark-600 uppercase tracking-wider border-b border-dark-100 pb-2 mb-4">
          {t('appointments.form.customerInfo')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label={`${t('appointments.form.customerName')} *`} placeholder={t('customers.form.fullNamePlaceholder')}
            value={form.customer_name}  onChange={(e) => set('customer_name', e.target.value)}  error={errors.customer_name} />
          <Input label={`${t('appointments.form.customerPhone')} *`} placeholder={t('customers.form.phonePlaceholder')}
            value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} error={errors.customer_phone} />
          <Input label={t('appointments.form.customerEmail')} type="email" placeholder={t('auth.emailPlaceholder')}
            value={form.customer_email} onChange={(e) => set('customer_email', e.target.value)} error={errors.customer_email} className="sm:col-span-2" />
        </div>
      </div>

      {/* Scheduling */}
      <div>
        <h3 className="text-sm font-semibold text-dark-600 uppercase tracking-wider border-b border-dark-100 pb-2 mb-4">
          {t('appointments.form.scheduling')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label={`${t('appointments.form.date')} *`} type="date" value={form.appointment_date}
            onChange={(e) => set('appointment_date', e.target.value)} error={errors.appointment_date} />
          <Input label={`${t('appointments.form.time')} *`} type="time" value={form.appointment_time}
            onChange={(e) => set('appointment_time', e.target.value)} error={errors.appointment_time} />
          <Select label={t('appointments.form.duration')} value={form.duration_minutes}
            onChange={(e) => set('duration_minutes', Number(e.target.value))} options={DURATION_OPTIONS} />
          <Select label={t('appointments.form.type')} value={form.type}
            onChange={(e) => set('type', e.target.value)} options={TYPE_OPTIONS} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <h3 className="text-sm font-semibold text-dark-600 uppercase tracking-wider border-b border-dark-100 pb-2 mb-4">
          {t('appointments.form.notes')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1.5">{t('appointments.form.customerNotes')}</label>
            <textarea className="form-input w-full" rows={3}
              placeholder={t('appointments.form.customerNotesPlaceholder')}
              value={form.customer_notes} onChange={(e) => set('customer_notes', e.target.value)} />
          </div>
          {showAdminNotes && (
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1.5">
                {t('appointments.form.adminNotes')} <span className="text-dark-400 text-xs">{t('appointments.form.adminNotesHint')}</span>
              </label>
              <textarea className="form-input w-full" rows={2}
                placeholder={t('appointments.form.adminNotesPlaceholder')}
                value={form.admin_notes} onChange={(e) => set('admin_notes', e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" loading={loading}>
          {submitLabel ?? t('appointments.form.saveAppointment')}
        </Button>
      </div>
    </form>
  );
}

export default AppointmentForm;
