import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import PropertyForm, { EMPTY_FORM } from '../components/PropertyForm';
import ImageUploader from '../components/ImageUploader';
import VideoUploader from '../components/VideoUploader';
import { createProperty } from '../../../services/propertyService';
import { useI18n } from '../../../i18n';

function AddPropertyPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading,     setLoading]     = useState(false);
  const [savedPropId, setSavedPropId] = useState(null);

  const handleCreate = async (payload) => {
    setLoading(true);
    try {
      const property = await createProperty(payload);
      setSavedPropId(property.id);
      toast.success(t('toast.propertyCreated'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () =>
    navigate(savedPropId ? `/properties/${savedPropId}` : '/properties');

  function StepBadge({ n, active, done }) {
    return (
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
        ${done   ? 'bg-success text-white'
        : active ? 'bg-primary-800 text-white'
                 : 'bg-dark-300 text-white'}`}>
        {done ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : n}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('properties.addProperty')}
        subtitle={t('properties.form.propertyInfo')}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'),   href: '/dashboard' },
          { label: t('breadcrumbs.properties'),  href: '/properties' },
          { label: t('properties.addProperty') },
        ]}
      />

      <div className="max-w-3xl space-y-6">
        {/* ── Step 1 — Property Details ─────────────────────── */}
        <Card>
          <Card.Header>
            <div className="flex items-center gap-3">
              <StepBadge n="1" done={!!savedPropId} active={!savedPropId} />
              <span className="font-semibold text-dark-800">{t('properties.form.step1')}</span>
            </div>
          </Card.Header>

          {savedPropId ? (
            <p className="text-sm text-success font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {t('toast.propertyCreated')}
            </p>
          ) : (
            <PropertyForm
              initialValues={EMPTY_FORM}
              onSubmit={handleCreate}
              loading={loading}
              submitLabel={t('properties.form.saveProperty')}
            />
          )}
        </Card>

        {/* ── Step 2 — Photos ───────────────────────────────── */}
        <Card className={!savedPropId ? 'opacity-50 pointer-events-none' : ''}>
          <Card.Header>
            <div className="flex items-center gap-3">
              <StepBadge n="2" done={false} active={!!savedPropId} />
              <span className="font-semibold text-dark-800">{t('properties.form.step2')}</span>
              {!savedPropId && (
                <span className="text-xs text-dark-400">{t('properties.form.completeStep1')}</span>
              )}
            </div>
          </Card.Header>
          <ImageUploader propertyId={savedPropId} onUploaded={() => {}} />
        </Card>

        {/* ── Step 3 — Videos ───────────────────────────────── */}
        <Card className={!savedPropId ? 'opacity-50 pointer-events-none' : ''}>
          <Card.Header>
            <div className="flex items-center gap-3">
              <StepBadge n="3" done={false} active={!!savedPropId} />
              <span className="font-semibold text-dark-800">{t('properties.form.step3')}</span>
              <span className="text-xs text-dark-400">{t('properties.form.videosOptional')}</span>
              {!savedPropId && (
                <span className="text-xs text-dark-400">{t('properties.form.completeStep1')}</span>
              )}
            </div>
          </Card.Header>
          <VideoUploader propertyId={savedPropId} onUploaded={() => {}} />
        </Card>

        {/* ── Finish ────────────────────────────────────────── */}
        {savedPropId && (
          <div className="flex justify-end">
            <button onClick={handleFinish} className="btn-primary btn-lg">
              {t('properties.form.viewProperty')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AddPropertyPage;
