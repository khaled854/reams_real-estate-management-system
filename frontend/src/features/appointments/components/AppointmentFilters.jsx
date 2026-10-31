import Input    from '../../../components/common/Input';
import Select   from '../../../components/common/Select';
import Button   from '../../../components/common/Button';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '../../../services/appointmentService';
import { useI18n } from '../../../i18n';

/**
 * AppointmentFilters — controlled filter bar.
 * All labels resolved from i18n so they update with the active language.
 */
function AppointmentFilters({ filters, setFilter, resetFilters }) {
  const { t } = useI18n();

  const STATUS_OPTIONS = [
    { value: '', label: t('appointments.filters.allStatuses') },
    ...APPOINTMENT_STATUSES.map((s) => ({ value: s, label: t(`appointments.status.${s}`) || s })),
  ];

  const TYPE_OPTIONS = [
    { value: '', label: t('appointments.filters.allTypes') },
    ...APPOINTMENT_TYPES.map((tp) => ({ value: tp, label: t(`appointments.type.${tp}`) || tp })),
  ];

  const SORT_OPTIONS = [
    { value: 'appointment_date', label: t('common.date') },
    { value: 'created_at',       label: t('common.createdAt') },
    { value: 'customer_name',    label: t('common.name') },
    { value: 'status',           label: t('common.status') },
  ];

  const hasFilters =
    filters.search || filters.status || filters.type ||
    filters.date_from || filters.date_to;

  return (
    <div className="bg-white rounded-xl border border-dark-100 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input
          placeholder={t('appointments.filters.searchPlaceholder')}
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          leftIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
            </svg>
          }
        />
        <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={STATUS_OPTIONS} />
        <Select value={filters.type}   onChange={(e) => setFilter('type',   e.target.value)} options={TYPE_OPTIONS} />
        <div className="flex gap-2">
          <Select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} options={SORT_OPTIONS} className="flex-1" />
          <button
            onClick={() => setFilter('order', filters.order === 'ASC' ? 'DESC' : 'ASC')}
            className="px-3 py-2 border border-dark-200 rounded-lg text-dark-600 hover:bg-dark-50 transition-colors shrink-0"
            title={filters.order === 'ASC' ? t('common.from') : t('common.to')}
          >
            {filters.order === 'ASC' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input type="date" label={t('appointments.filters.dateFrom')} value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} />
        <Input type="date" label={t('appointments.filters.dateTo')}   value={filters.date_to}   onChange={(e) => setFilter('date_to',   e.target.value)} />
        {hasFilters && (
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="w-full">
              {t('common.clear')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppointmentFilters;
