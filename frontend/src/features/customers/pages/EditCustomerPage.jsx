import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import Spinner from '../../../components/common/Spinner';
import CustomerForm from '../components/CustomerForm';
import { getCustomer, updateCustomer } from '../../../services/customerService';
import usePermissions from '../../../hooks/usePermissions';
import useAuthStore from '../../../store/authStore';
import { useI18n } from '../../../i18n';

function EditCustomerPage() {
  const navigate    = useNavigate();
  const { id }      = useParams();
  const { user }    = useAuthStore();
  const { isAdmin } = usePermissions();
  const { t }       = useI18n();

  const [customer, setCustomer] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await getCustomer(id);
        if (!isAdmin && c.employee_id !== user?.id) {
          toast.error(t('toast.actionFailed'));
          navigate('/customers');
          return;
        }
        setCustomer(c);
      } catch (err) {
        toast.error(err.response?.data?.message || t('toast.loadFailed'));
        navigate('/customers');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      await updateCustomer(id, payload);
      toast.success(t('toast.customerUpdated'));
      navigate(`/customers/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="xl" /></div>;
  if (!customer) return null;

  const initialValues = {
    name:          customer.name          ?? '',
    phone:         customer.phone         ?? '',
    email:         customer.email         ?? '',
    national_id:   customer.national_id   ?? '',
    property_type: customer.property_type ?? '',
    location:      customer.location      ?? '',
    budget:        customer.budget        != null ? String(customer.budget)     : '',
    budget_min:    customer.budget_min    != null ? String(customer.budget_min) : '',
    notes:         customer.notes         ?? '',
    status:        customer.status        ?? 'new',
    source:        customer.source        ?? '',
  };

  return (
    <div>
      <PageHeader
        title={t('customers.editCustomer')}
        subtitle={customer.name}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('breadcrumbs.customers'), href: '/customers' },
          { label: customer.name, href: `/customers/${id}` },
          { label: t('breadcrumbs.edit') },
        ]}
      />
      <div className="max-w-2xl">
        <Card>
          <CustomerForm
            initialValues={initialValues}
            onSubmit={handleSave}
            loading={saving}
            submitLabel={t('common.save')}
            showStatus
          />
        </Card>
      </div>
    </div>
  );
}

export default EditCustomerPage;
