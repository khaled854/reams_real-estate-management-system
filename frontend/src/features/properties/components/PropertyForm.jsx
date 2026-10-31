import { useState, useEffect } from 'react';
import clsx from 'clsx';
import Input from '../../../components/common/Input';
import Select from '../../../components/common/Select';
import Button from '../../../components/common/Button';
import { getPropertyTypes } from '../../../services/propertyService';
import { useI18n } from '../../../i18n';

export const EMPTY_FORM = {
  type_id: '', type: '', title: '', description: '',
  location: '', address: '', area: '', rooms: '',
  bedrooms: '', bathrooms: '', floor: '', price: '',
  payment_method: 'cash', owner_name: '', owner_phone: '',
  listing_type: 'sale', status: 'available', is_featured: false,
};

function Section({ title, children, className }) {
  return (
    <div className={clsx('space-y-4', className)}>
      <h3 className="text-sm font-semibold text-dark-600 uppercase tracking-wider border-b border-dark-100 pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function PropertyForm({ initialValues = EMPTY_FORM, onSubmit, loading = false, submitLabel }) {
  const { t } = useI18n();
  const [form,   setForm]   = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [types,  setTypes]  = useState([]);

  useEffect(() => {
    getPropertyTypes().then((tp) => setTypes(tp)).catch(() => {});
  }, []);

  useEffect(() => {
    setForm(initialValues);
  }, [JSON.stringify(initialValues)]); // eslint-disable-line

  // i18n-driven option arrays (re-evaluated each render so language switch is instant)
  const PAYMENT_METHODS = [
    { value: 'cash',        label: t('properties.paymentMethod.cash') },
    { value: 'installment', label: t('properties.paymentMethod.installment') },
    { value: 'mortgage',    label: t('properties.paymentMethod.mortgage') },
    { value: 'lease',       label: t('properties.paymentMethod.lease') },
    { value: 'negotiable',  label: t('properties.paymentMethod.negotiable') },
  ];
  const LISTING_TYPES = [
    { value: 'sale', label: t('properties.listingType.sale') },
    { value: 'rent', label: t('properties.listingType.rent') },
    { value: 'both', label: t('properties.listingType.both') },
  ];
  const STATUSES = [
    { value: 'available',  label: t('properties.status.available') },
    { value: 'reserved',   label: t('properties.status.reserved') },
    { value: 'sold',       label: t('properties.status.sold') },
    { value: 'rented',     label: t('properties.status.rented') },
    { value: 'off_market', label: t('properties.status.off_market') },
  ];

  const typeOptions = types.map((tp) => ({ value: String(tp.id), label: tp.name }));

  function validateForm(frm) {
    const errs = {};
    if (!frm.type_id)              errs.type_id    = t('validation.propertyTypeRequired');
    if (!frm.title?.trim())        errs.title      = t('validation.titleRequired');
    if (!frm.location?.trim())     errs.location   = t('validation.locationRequired');
    if (!frm.address?.trim())      errs.address    = t('validation.addressRequired');
    if (!frm.area || Number(frm.area) <= 0)   errs.area      = t('validation.areaRequired');
    if (!frm.price || Number(frm.price) <= 0) errs.price     = t('validation.priceRequired');
    if (!frm.owner_name?.trim())   errs.owner_name  = t('validation.ownerNameRequired');
    if (!frm.owner_phone?.trim())  errs.owner_phone = t('validation.ownerPhoneRequired');
    return errs;
  }

  const set = (key, value) => {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      if (key === 'type_id') {
        const found = types.find((tp) => String(tp.id) === String(value));
        updated.type = found ? found.name : '';
      }
      return updated;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSubmit({
      ...form,
      type_id: parseInt(form.type_id), area: parseFloat(form.area), price: parseFloat(form.price),
      rooms:     form.rooms     !== '' ? parseInt(form.rooms)     : null,
      bedrooms:  form.bedrooms  !== '' ? parseInt(form.bedrooms)  : null,
      bathrooms: form.bathrooms !== '' ? parseInt(form.bathrooms) : null,
      floor:     form.floor     !== '' ? parseInt(form.floor)     : null,
      is_featured: Boolean(form.is_featured),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">

      <Section title={t('properties.form.propertyInfo')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select id="type_id" label={t('properties.form.propertyType')} required
            value={form.type_id} onChange={(e) => set('type_id', e.target.value)}
            options={typeOptions} placeholder={t('properties.form.selectType')} error={errors.type_id} />
          <Select label={t('properties.form.listingType')} value={form.listing_type}
            onChange={(e) => set('listing_type', e.target.value)} options={LISTING_TYPES} />
        </div>
        <Input id="title" label={t('properties.form.title')} required
          placeholder={t('properties.form.titlePlaceholder')}
          value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} />
        <div className="w-full">
          <label htmlFor="description" className="form-label">{t('properties.form.description')}</label>
          <textarea id="description" rows={4} placeholder={t('properties.form.descPlaceholder')}
            value={form.description} onChange={(e) => set('description', e.target.value)}
            className="input-base resize-y" />
        </div>
      </Section>

      <Section title={t('properties.form.location')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="location" label={t('properties.form.locationLabel')} required
            placeholder={t('properties.form.locationPlaceholder')}
            value={form.location} onChange={(e) => set('location', e.target.value)} error={errors.location} />
          <Input id="address" label={t('properties.form.address')} required
            placeholder={t('properties.form.addressPlaceholder')}
            value={form.address} onChange={(e) => set('address', e.target.value)} error={errors.address} />
        </div>
      </Section>

      <Section title={t('properties.form.physicalDetails')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input id="area"  label={t('properties.form.areaM2')}   required type="number" min="1"  step="0.01" placeholder="185" value={form.area}      onChange={(e) => set('area', e.target.value)}      error={errors.area} />
          <Input            label={t('properties.form.rooms')}              type="number" min="0"  max="99"    placeholder="5"   value={form.rooms}     onChange={(e) => set('rooms', e.target.value)} />
          <Input            label={t('properties.form.bedrooms')}           type="number" min="0"  max="99"    placeholder="3"   value={form.bedrooms}  onChange={(e) => set('bedrooms', e.target.value)} />
          <Input            label={t('properties.form.bathrooms')}          type="number" min="0"  max="99"    placeholder="2"   value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
        </div>
        <div className="w-40">
          <Input label={t('properties.form.floor')} type="number" min="-5" max="200"
            placeholder={t('properties.form.floorPlaceholder')} value={form.floor} onChange={(e) => set('floor', e.target.value)} />
        </div>
      </Section>

      <Section title={t('properties.form.pricing')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="price" label={t('properties.form.priceSAR')} required type="number" min="1" step="0.01" placeholder="750000"
            value={form.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
          <Select label={t('properties.form.paymentMethod')} value={form.payment_method}
            onChange={(e) => set('payment_method', e.target.value)} options={PAYMENT_METHODS} />
        </div>
      </Section>

      <Section title={t('properties.form.ownerInfo')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="owner_name"  label={t('properties.form.ownerName')}  required placeholder={t('properties.form.ownerNamePlaceholder')}
            value={form.owner_name}  onChange={(e) => set('owner_name', e.target.value)}  error={errors.owner_name} />
          <Input id="owner_phone" label={t('properties.form.ownerPhone')} required type="tel" placeholder={t('properties.form.ownerPhonePlaceholder')}
            value={form.owner_phone} onChange={(e) => set('owner_phone', e.target.value)} error={errors.owner_phone} />
        </div>
      </Section>

      <Section title={t('properties.form.listingSettings')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label={t('common.status')} value={form.status} onChange={(e) => set('status', e.target.value)} options={STATUSES} />
        </div>
        <label className="inline-flex items-center gap-3 cursor-pointer select-none mt-1">
          <div className="relative">
            <input type="checkbox" className="sr-only peer" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
            <div className="w-10 h-5 bg-dark-200 peer-checked:bg-primary-800 rounded-full transition-colors duration-200" />
            <div className="absolute start-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
          </div>
          <div>
            <span className="text-sm font-medium text-dark-700">{t('properties.form.featuredListing')}</span>
            <p className="text-xs text-dark-400">{t('properties.form.featuredHint')}</p>
          </div>
        </label>
      </Section>

      <div className="flex justify-end gap-3 pt-4 border-t border-dark-100">
        <Button type="submit" loading={loading} size="lg">
          {submitLabel ?? t('properties.form.saveProperty')}
        </Button>
      </div>
    </form>
  );
}

export default PropertyForm;
