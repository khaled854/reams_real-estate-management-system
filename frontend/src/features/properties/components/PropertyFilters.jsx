import clsx from 'clsx';
import { useI18n } from '../../../i18n';

function FilterSelect({ value, onChange, options, className }) {
  const { isRTL } = useI18n();
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'input-base appearance-none py-2 text-sm cursor-pointer min-w-0',
          isRTL ? 'ps-3 pe-8' : 'ps-3 pe-8',
          className
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className={clsx(
        'pointer-events-none absolute inset-y-0 flex items-center text-dark-400',
        isRTL ? 'left-2.5' : 'right-2.5'
      )}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
}

function PropertyFilters({ filters, setFilter, resetFilters, types = [] }) {
  const { t } = useI18n();

  const STATUS_OPTIONS = [
    { value: '',           label: t('properties.filters.allStatuses') },
    { value: 'available',  label: t('properties.status.available') },
    { value: 'reserved',   label: t('properties.status.reserved') },
    { value: 'sold',       label: t('properties.status.sold') },
    { value: 'rented',     label: t('properties.status.rented') },
    { value: 'off_market', label: t('properties.status.off_market') },
  ];

  const LISTING_OPTIONS = [
    { value: '',     label: t('properties.filters.allListings') },
    { value: 'sale', label: t('properties.listingType.sale') },
    { value: 'rent', label: t('properties.listingType.rent') },
    { value: 'both', label: t('properties.listingType.both') },
  ];

  const typeOptions = [
    { value: '', label: t('properties.filters.allTypes') },
    ...types.map((tp) => ({ value: String(tp.id), label: tp.name })),
  ];

  const hasActiveFilters =
    filters.search || filters.status || filters.listing_type ||
    filters.type_id || filters.min_price || filters.max_price;

  return (
    <div className="card !p-4 mb-5">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 start-3 flex items-center text-dark-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder={t('properties.filters.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="input-base ps-10 py-2 text-sm"
          />
        </div>
        <FilterSelect value={filters.status}       onChange={(v) => setFilter('status', v)}       options={STATUS_OPTIONS}  className="w-40" />
        <FilterSelect value={filters.listing_type} onChange={(v) => setFilter('listing_type', v)} options={LISTING_OPTIONS} className="w-40" />
        <FilterSelect value={filters.type_id}      onChange={(v) => setFilter('type_id', v)}      options={typeOptions}     className="w-44" />
        <div className="flex items-center gap-2 min-w-[200px]">
          <input type="number" placeholder={t('properties.filters.minPrice')} value={filters.min_price}
            onChange={(e) => setFilter('min_price', e.target.value)} className="input-base py-2 text-sm w-28" min="0" />
          <span className="text-dark-400 text-sm shrink-0">—</span>
          <input type="number" placeholder={t('properties.filters.maxPrice')} value={filters.max_price}
            onChange={(e) => setFilter('max_price', e.target.value)} className="input-base py-2 text-sm w-28" min="0" />
        </div>
        {hasActiveFilters && (
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

export default PropertyFilters;
