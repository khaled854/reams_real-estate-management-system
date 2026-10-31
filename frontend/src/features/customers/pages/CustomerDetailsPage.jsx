import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Spinner from '../../../components/common/Spinner';
import Badge from '../../../components/common/Badge';
import { ConfirmModal } from '../../../components/common/Modal';
import CustomerStatusBadge from '../components/CustomerStatusBadge';
import { getCustomer, deleteCustomer, updateCustomerStatus } from '../../../services/customerService';
import usePermissions from '../../../hooks/usePermissions';
import useAuthStore from '../../../store/authStore';
import { useI18n } from '../../../i18n';

function fmtDate(d, locale = 'en-US') {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(d));
}
function fmtBudget(n, locale = 'en-US') {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(n);
}

function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-dark-50 last:border-0">
      <span className="text-sm text-dark-500">{label}</span>
      <span className="text-sm font-medium text-dark-800 text-right max-w-[60%] break-words">{value}</span>
    </div>
  );
}

const STATUS_OPTIONS_KEYS = ['new','contacted','interested','negotiating','closed','lost'];

const AVATAR_COLORS = [
  'bg-primary-800','bg-secondary-500','bg-success',
  'bg-info','bg-warning','bg-dark-600',
];
function avatarColor(name = '') {
  let h = 0;
  for (const c of name) h += c.charCodeAt(0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function CustomerDetailsPage() {
  const navigate         = useNavigate();
  const { id }           = useParams();
  const { user }         = useAuthStore();
  const { isAdmin, can } = usePermissions();
  const { t, language }  = useI18n();
  const locale           = language === 'ar' ? 'ar-EG' : 'en-US';

  const STATUS_OPTIONS = STATUS_OPTIONS_KEYS.map((v) => ({ value: v, label: t(`customers.status.${v}`) }));

  const [customer,     setCustomer]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  const canEdit   = isAdmin || (can('create_customer') && customer?.employee_id === user?.id);
  const canDelete = isAdmin || can('delete_customer');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getCustomer(id);
      setCustomer(c);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Customer not found');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  }, [id]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (status) => {
    setSavingStatus(true);
    try {
      const updated = await updateCustomerStatus(id, status);
      setCustomer((c) => ({ ...c, status: updated.status }));
      toast.success(t('toast.statusUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.actionFailed'));
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCustomer(id);
      toast.success(t('toast.customerDeleted'));
      navigate('/customers');
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.deleteFailed'));
      setDeleting(false);
      setShowDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="xl" />
      </div>
    );
  }
  if (!customer) return null;

  const initials = customer.name.trim().split(/\s+/)
    .slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  return (
    <div>
      <PageHeader
        title={customer.name}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'),  href: '/dashboard' },
          { label: t('breadcrumbs.customers'),  href: '/customers' },
          { label: customer.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${id}/edit`)}>
                {t('common.edit')}
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
                {t('common.delete')}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left column ──────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Profile hero card */}
          <Card>
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className={clsx(
                'w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0',
                avatarColor(customer.name)
              )}>
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="text-xl font-bold text-dark-800">{customer.name}</h2>
                  <CustomerStatusBadge status={customer.status} />
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-dark-500">
                  <a href={`tel:${customer.phone}`}
                    className="flex items-center gap-1.5 hover:text-primary-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    {customer.phone}
                  </a>
                  {customer.email && (
                    <a href={`mailto:${customer.email}`}
                      className="flex items-center gap-1.5 hover:text-primary-800 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                      {customer.email}
                    </a>
                  )}
                </div>

                {customer.source && (
                  <div className="mt-3">
                    <span className="text-xs bg-dark-100 text-dark-600 px-2.5 py-1 rounded-full font-medium">
                      {t('customers.form.leadSource')}: {t(`customers.source.${customer.source}`) || customer.source}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Property requirements */}
          <Card>
            <Card.Header>{t('customers.form.propertyRequirements')}</Card.Header>
            <DetailRow label={t('customers.form.requestedType')}      value={customer.property_type ? t(`customers.propertyTypes.${customer.property_type}`) || customer.property_type : null} />
            <DetailRow label={t('customers.form.preferredLocation')}  value={customer.location} />
            <DetailRow label={t('customers.form.maxBudget')}          value={fmtBudget(customer.budget, locale)} />
            <DetailRow label={t('customers.form.minBudget')}          value={customer.budget_min ? fmtBudget(customer.budget_min, locale) : null} />
            {!customer.property_type && !customer.location && !customer.budget && (
              <p className="text-sm text-dark-400 italic">{t('common.noData')}</p>
            )}
          </Card>

          {customer.notes && (
            <Card>
              <Card.Header>{t('common.notes')}</Card.Header>
              <p className="text-sm text-dark-600 leading-relaxed whitespace-pre-wrap">{customer.notes}</p>
            </Card>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────── */}
        <div className="space-y-5">

          {/* Status & quick actions */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-dark-700">{t('customers.form.crmInfo')}</h4>
              <CustomerStatusBadge status={customer.status} />
            </div>
            {canEdit && (
              <div>
                <label className="form-label text-xs mb-1.5">{t('common.status')}</label>
                <div className="relative">
                  <select value={customer.status} onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={savingStatus} className="input-base appearance-none pe-9 text-sm cursor-pointer">
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-dark-400">
                    {savingStatus ? <Spinner size="xs" /> : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </span>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <Card.Header>{t('customers.nationalId')}</Card.Header>
            <DetailRow label={t('customers.form.nationalId')} value={customer.national_id} />
            <DetailRow label={t('common.createdAt')}          value={fmtDate(customer.created_at, locale)} />
            <DetailRow label={t('common.updatedAt')}          value={fmtDate(customer.updated_at, locale)} />
          </Card>

          <Card>
            <Card.Header>{t('customers.form.assignedTo')}</Card.Header>
            {customer.employee_name ? (
              <>
                <DetailRow label={t('common.name')}  value={customer.employee_name} />
                <DetailRow label={t('common.phone')} value={customer.employee_phone} />
              </>
            ) : (
              <p className="text-sm text-dark-400 italic">{t('common.unassigned')}</p>
            )}
          </Card>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t('customers.deleteConfirm.title')}
        message={t('customers.deleteConfirm.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

export default CustomerDetailsPage;
