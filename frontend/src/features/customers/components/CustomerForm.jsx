import { useState, useEffect } from 'react';
import Input from '../../../components/common/Input';
import Select from '../../../components/common/Select';
import Button from '../../../components/common/Button';
import { useI18n } from '../../../i18n';

export const EMPTY_FORM = {
  name: '', phone: '', email: '', national_id: '',
  property_type: '', location: '', budget: '', budget_min: '',
  notes: '', status: 'new', source: '',
};

const PROPERTY_TYPE_VALUES = [
  'Apartment','Villa','Shop','Land','Office','Townhouse','Warehouse','Building','Duplex','Studio',
];
const SOURCE_VALUES = ['walk-in','referral','website','social','phone','other'];

function validate(form, t) {
  const errors = {};
  if (!form.name?.trim())  errors.name  = t('validation.nameRequired');
  if (!form.phone?.trim()) errors.phone = t('validation.phoneRequired');
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = t('validation.invalidEmail');
  }
  if (form.budget && Number(form.budget) <= 0) {
    errors.budget = t('validation.budgetPositive');
  }
  return errors;
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-dark-600 uppercase tracking-wider border-b border-dark-100 pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CustomerForm({
  initialValues = EMPTY_FORM,
  onSubmit,
  loading     = false,
  submitLabel,
  showStatus  = true,
}) {
  const { t } = useI18n();
  const [form,   setForm]   = useState(initialValues);
  const [errors, setErrors] = useState({});

  useEffect(() => { setForm(initialValues); }, [JSON.stringify(initialValues)]); // eslint-disable-line

  // Build i18n-aware option arrays
  const STATUS_OPTIONS = [
    { value: 'new',         label: t('customers.status.new') },
    { value: 'contacted',   label: t('customers.status.contacted') },
    { value: 'interested',  label: t('customers.status.interested') },
    { value: 'negotiating', label: t('customers.status.negotiating') },
    { value: 'closed',      label: t('customers.status.closed') },
    { value: 'lost',        label: t('customers.status.lost') },
  ];

  const PROPERTY_TYPE_OPTIONS = [
    { value: '', label: t('customers.form.notSpecified') },
    ...PROPERTY_TYPE_VALUES.map((v) => ({
      value: v,
      label: t(`customers.propertyTypes.${v}`) || v,
    })),
  ];

  const SOURCE_OPTIONS = [
    { value: '', label: t('customers.form.notSpecified') },
    ...SOURCE_VALUES.map((v) => ({
      value: v,
      label: t(`customers.source.${v}`) || v,
    })),
  ];

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(form, t);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const payload = {
      ...form,
      budget:        form.budget     !== '' ? parseFloat(form.budget)     : null,
      budget_min:    form.budget_min !== '' ? parseFloat(form.budget_min) : null,
      email:         form.email         || null,
      national_id:   form.national_id   || null,
      property_type: form.property_type || null,
      location:      form.location      || null,
      notes:         form.notes         || null,
      source:        form.source        || null,
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">

      <Section title={t('customers.form.contactInfo')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="name"  label={t('customers.form.fullName')}   required placeholder={t('customers.form.fullNamePlaceholder')}  value={form.name}  onChange={(e) => set('name', e.target.value)}  error={errors.name} />
          <Input id="phone" label={t('customers.form.phoneNumber')} required type="tel" placeholder={t('customers.form.phonePlaceholder')} value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="email" label={t('customers.form.emailAddress')} type="email" placeholder={t('customers.form.emailPlaceholder')} value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
          <Input label={t('customers.form.nationalId')} placeholder={t('customers.form.nationalIdPlaceholder')} value={form.national_id} onChange={(e) => set('national_id', e.target.value)} />
        </div>
      </Section>

      <Section title={t('customers.form.propertyRequirements')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label={t('customers.form.requestedType')} value={form.property_type} onChange={(e) => set('property_type', e.target.value)} options={PROPERTY_TYPE_OPTIONS} placeholder={null} />
          <Input label={t('customers.form.preferredLocation')} placeholder={t('customers.form.locationPlaceholder')} value={form.location} onChange={(e) => set('location', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="budget" label={t('customers.form.maxBudget')} type="number" min="0" step="1000" placeholder="1,000,000" value={form.budget} onChange={(e) => set('budget', e.target.value)} error={errors.budget} />
          <Input label={t('customers.form.minBudget')} type="number" min="0" step="1000" placeholder="500,000" value={form.budget_min} onChange={(e) => set('budget_min', e.target.value)} />
        </div>
      </Section>

      <Section title={t('customers.form.crmInfo')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showStatus && (
            <Select label={t('customers.form.status')} value={form.status} onChange={(e) => set('status', e.target.value)} options={STATUS_OPTIONS} placeholder={null} />
          )}
          <Select label={t('customers.form.leadSource')} value={form.source} onChange={(e) => set('source', e.target.value)} options={SOURCE_OPTIONS} placeholder={null} />
        </div>
        <div>
          <label className="form-label">{t('customers.form.notes')}</label>
          <textarea rows={4} placeholder={t('customers.form.notesPlaceholder')}
            value={form.notes} onChange={(e) => set('notes', e.target.value)}
            className="input-base resize-y" />
        </div>
      </Section>

      <div className="flex justify-end gap-3 pt-4 border-t border-dark-100">
        <Button type="submit" loading={loading} size="lg">
          {submitLabel ?? t('customers.form.saveCustomer')}
        </Button>
      </div>
    </form>
  );
}

export default CustomerForm;
