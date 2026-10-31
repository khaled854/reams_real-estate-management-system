import clsx from 'clsx';
import { useI18n } from '../../../i18n';

// Property type values come from the DB — labels are translated at the UI layer
const PROPERTY_TYPE_VALUES = ['Apartment','Villa','Shop','Land','Office','Townhouse','Warehouse'];

function FilterSelect({ value, onChange, options, className }) {
  const { isRTL } = useI18n();
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={clsx('input-base appearance-none pe-8 py-2 text-sm cursor-pointer', className)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className={clsx('pointer-events-none absolute inset-y-0 flex items-center text-dark-400', isRTL ? 'left-2.5' : 'right-2.5')}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
}

function CustomerFilters({ filters, setFilter, resetFilters }) {
  const { t } = useI18n();

  const STATUS_OPTIONS = [
    { value: '',            label: t('customers.filters.allStatuses') },
    { value: 'new',         label: t('customers.status.new') },
    { value: 'contacted',   label: t('customers.status.contacted') },
    { value: 'interested',  label: t('customers.status.interested') },
    { value: 'negotiating', label: t('customers.status.negotiating') },
    { value: 'closed',      label: t('customers.status.closed') },
    { value: 'lost',        label: t('customers.status.lost') },
  ];

  const PROPERTY_TYPES = [
    { value: '', label: t('common.all') },
    ...PROPERTY_TYPE_VALUES.map((v) => ({
      value: v,
      label: t(`customers.propertyTypes.${v}`) || v,
    })),
  ];

  const hasActive = filters.search || filters.status || filters.property_type || filters.location;

  return (
    <div className="card !p-4 mb-5">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 start-3 flex items-center text-dark-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input type="search" placeholder={t('customers.filters.searchPlaceholder')}
            value={filters.search} onChange={(e) => setFilter('search', e.target.value)}
            className="input-base ps-10 py-2 text-sm" />
        </div>
        <FilterSelect value={filters.status}        onChange={(v) => setFilter('status', v)}        options={STATUS_OPTIONS}  className="w-44" />
        <FilterSelect value={filters.property_type} onChange={(v) => setFilter('property_type', v)} options={PROPERTY_TYPES}  className="w-44" />
        <input type="text" placeholder={t('customers.form.locationPlaceholder')}
          value={filters.location} onChange={(e) => setFilter('location', e.target.value)}
          className="input-base py-2 text-sm w-44" />
        {hasActive && (
          <button onClick={resetFilters} className="btn-ghost btn-sm gap-1.5 text-danger hover:bg-danger-light">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t('common.clear')}
          </button>
        )}
      </div>
    </div>
  );
}

export default CustomerFilters;
