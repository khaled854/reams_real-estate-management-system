import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import CustomerForm, { EMPTY_FORM } from '../components/CustomerForm';
import { createCustomer } from '../../../services/customerService';
import { useI18n } from '../../../i18n';

function AddCustomerPage() {
  const navigate = useNavigate();
  const { t }    = useI18n();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (payload) => {
    setLoading(true);
    try {
      const customer = await createCustomer(payload);
      toast.success(t('toast.customerCreated'));
      navigate(`/customers/${customer.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('customers.addCustomer')}
        subtitle={t('customers.form.crmInfo')}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('breadcrumbs.customers'), href: '/customers' },
          { label: t('customers.addCustomer') },
        ]}
      />
      <div className="max-w-2xl">
        <Card>
          <CustomerForm
            initialValues={EMPTY_FORM}
            onSubmit={handleSubmit}
            loading={loading}
            submitLabel={t('customers.addCustomer')}
            showStatus={false}
          />
        </Card>
      </div>
    </div>
  );
}

export default AddCustomerPage;
