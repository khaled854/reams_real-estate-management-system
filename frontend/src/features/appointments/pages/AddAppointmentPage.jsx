import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast          from 'react-hot-toast';
import PageHeader     from '../../../components/common/PageHeader';
import Card           from '../../../components/common/Card';
import Input          from '../../../components/common/Input';
import Spinner        from '../../../components/common/Spinner';
import Button         from '../../../components/common/Button';
import AppointmentForm, { EMPTY_APPOINTMENT_FORM } from '../components/AppointmentForm';
import { createAppointment }  from '../../../services/appointmentService';
import { getProperties }      from '../../../services/propertyService';
import { useI18n }            from '../../../i18n';

/* ─────────────────────────────────────────────────────────────
   PropertySelector
   Live-search the properties API as the user types.
   Selecting a result locks in the property_id and shows the title.
   ───────────────────────────────────────────────────────────── */
function PropertySelector({ value, onChange, error }) {
  const { t }              = useI18n();
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [selected, setSelected] = useState(null);  // { id, title, location }
  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  // Pre-populate if property_id was passed via URL query param
  useEffect(() => {
    if (value && !selected) {
      // Fetch just this one property to get its title
      getProperties({ limit: 1 })
        .then(() => {}) // best-effort; title shown after first search
        .catch(() => {});
    }
  }, []); // eslint-disable-line

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    // Clear selection when user edits the search box
    if (selected) {
      setSelected(null);
      onChange(null);
    }
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getProperties({ search: q, limit: 10, status: 'available' });
        setResults(res.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = (prop) => {
    setSelected(prop);
    setQuery(prop.title);
    setOpen(false);
    setResults([]);
    onChange(prop.id);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    onChange(null);
    setResults([]);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="form-label">
        {t('appointments.form.propertyId')} <span className="text-danger">*</span>
      </label>
      <div className="relative">
        <Input
          placeholder={t('properties.searchPlaceholder') || 'Search properties by title or location…'}
          value={query}
          onChange={handleSearch}
          onFocus={() => { if (results.length) setOpen(true); }}
          error={error}
          className={selected ? 'pr-8' : ''}
          readOnly={false}
          autoComplete="off"
        />
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-3 flex items-center text-dark-400 hover:text-dark-700"
            aria-label="Clear"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Selected property confirmation badge */}
      {selected && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-success font-medium">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>
            {t('properties.table.property') || 'Property'} #{selected.id} — {selected.location}
          </span>
        </div>
      )}

      {/* Dropdown */}
      {open && (loading || results.length > 0) && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-xl border border-dark-100 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : (
            results.map((prop) => (
              <button
                key={prop.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(prop); }}
                className="w-full text-start px-4 py-3 hover:bg-primary-50 flex flex-col gap-0.5 border-b border-dark-50 last:border-0"
              >
                <span className="text-sm font-medium text-dark-800 truncate">{prop.title}</span>
                <span className="text-xs text-dark-500">{prop.location} · #{prop.id}</span>
              </button>
            ))
          )}
          {!loading && results.length === 0 && (
            <p className="text-sm text-dark-400 px-4 py-3">
              {t('properties.noProperties') || 'No properties found'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   AddAppointmentPage
   ───────────────────────────────────────────────────────────── */
function AddAppointmentPage() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const { t }           = useI18n();

  // If navigated from a property page, ?property_id=X pre-selects the property
  const preloadId = searchParams.get('property_id') ? Number(searchParams.get('property_id')) : null;

  const [propertyId, setPropertyId] = useState(preloadId || null);
  const [propError,  setPropError]  = useState('');
  const [loading,    setLoading]    = useState(false);

  const handleSubmit = async (formData) => {
    // Validate property selection
    if (!propertyId) {
      setPropError(t('validation.required').replace('{field}', t('appointments.form.propertyId')));
      return;
    }
    setPropError('');
    setLoading(true);
    try {
      const apptData = await createAppointment({
        ...formData,
        property_id: propertyId,   // always a positive integer from the selector
        source:      'admin',
      });
      toast.success(t('toast.appointmentCreated') || 'Appointment created');
      navigate(`/appointments/${apptData.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.saveFailed') || 'Failed to create appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('appointments.addAppointment')}
        subtitle={t('appointments.subtitle')}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'),    href: '/dashboard' },
          { label: t('breadcrumbs.appointments'), href: '/appointments' },
          { label: t('appointments.addAppointment') },
        ]}
      />

      <Card>
        {/* Property selector */}
        <div className="mb-5">
          <PropertySelector
            value={propertyId}
            onChange={(id) => {
              setPropertyId(id);
              if (id) setPropError('');
            }}
            error={propError}
          />
        </div>
        <hr className="border-dark-100 mb-5" />

        <AppointmentForm
          initialValues={EMPTY_APPOINTMENT_FORM}
          onSubmit={handleSubmit}
          loading={loading}
          submitLabel={t('appointments.addAppointment')}
        />
      </Card>
    </div>
  );
}

export default AddAppointmentPage;
