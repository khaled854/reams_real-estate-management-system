import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import Spinner from '../../../components/common/Spinner';
import Badge from '../../../components/common/Badge';
import { ConfirmModal } from '../../../components/common/Modal';
import PropertyStatusBadge from '../components/PropertyStatusBadge';
import ImageGallery from '../components/ImageGallery';
import VideoGallery from '../components/VideoGallery';
import {
  getProperty, getPropertyImages, getPropertyVideos,
  deleteProperty, updatePropertyStatus,
} from '../../../services/propertyService';
import usePermissions from '../../../hooks/usePermissions';
import useAuthStore from '../../../store/authStore';
import { getImageUrl } from '../../../utils/imageUrl';
import { useI18n } from '../../../i18n';

/* ── Helpers ──────────────────────────────────────────────── */
function fmtPriceLocale(n, locale) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(n);
}

function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-dark-50 last:border-0">
      <span className="text-sm text-dark-500">{label}</span>
      <span className="text-sm font-medium text-dark-800 text-end max-w-[60%]">{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PropertyDetailsPage
══════════════════════════════════════════════════════════════ */
function PropertyDetailsPage() {
  const navigate         = useNavigate();
  const { id }           = useParams();
  const { user }         = useAuthStore();
  const { isAdmin, can } = usePermissions();
  const { t, language }  = useI18n();
  const locale           = language === 'ar' ? 'ar-EG' : 'en-US';

  const [property,      setProperty]      = useState(null);
  const [images,        setImages]        = useState([]);
  const [videos,        setVideos]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [deletingProp,  setDeletingProp]  = useState(false);
  const [showDeleteMdl, setShowDeleteMdl] = useState(false);
  const [savingStatus,  setSavingStatus]  = useState(false);

  const canEdit = isAdmin || (can('edit_own_property') && property?.agent_id === user?.id);
  const canDel  = isAdmin || can('delete_property');

  /* ── Load ──────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [prop, imgs, vids] = await Promise.all([
          getProperty(id),
          getPropertyImages(id),
          getPropertyVideos(id),
        ]);
        setProperty(prop);
        setImages(imgs);
        setVideos(vids);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Property not found');
        navigate('/properties');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line

  const refreshImages = async () => {
    const imgs = await getPropertyImages(id);
    setImages(imgs);
  };

  const refreshVideos = async () => {
    const vids = await getPropertyVideos(id);
    setVideos(vids);
  };

  /* ── Actions ───────────────────────────────────────────── */
  const handleDelete = async () => {
    setDeletingProp(true);
    try {
      await deleteProperty(id);
      toast.success(t('toast.propertyDeleted'));
      navigate('/properties');
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.deleteFailed'));
      setDeletingProp(false);
      setShowDeleteMdl(false);
    }
  };

  const handleStatusChange = async (status) => {
    setSavingStatus(true);
    try {
      const updated = await updatePropertyStatus(id, status);
      setProperty((p) => ({ ...p, status: updated.status }));
      toast.success(t('toast.statusUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.actionFailed'));
    } finally {
      setSavingStatus(false);
    }
  };

  /* ── Loading / empty states ────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="xl" />
      </div>
    );
  }
  if (!property) return null;

  const coverImage = images.find((i) => i.is_cover);

  return (
    <div>
      <PageHeader
        title={property.title}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'),  href: '/dashboard' },
          { label: t('breadcrumbs.properties'), href: '/properties' },
          { label: property.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/properties/${id}/edit`)}>
                {t('common.edit')}
              </Button>
            )}
            {canDel && (
              <Button variant="danger" size="sm" onClick={() => setShowDeleteMdl(true)}>
                {t('common.delete')}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ══════════════════════════════════════════════════
            Left column — media + description
        ══════════════════════════════════════════════════ */}
        <div className="xl:col-span-2 space-y-6">

          {/* Cover image hero */}
          {coverImage && (
            <div className="rounded-xl overflow-hidden aspect-video bg-dark-100 shadow-sm">
              <img
                src={getImageUrl(coverImage.image_path)}
                alt={property.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* ── Photos gallery ─────────────────────────── */}
          <Card>
            <Card.Header
              actions={
                <span className="text-xs text-dark-400">
                  {images.length} {images.length !== 1 ? t('properties.images.gallery').toLowerCase() : t('properties.images.gallery').toLowerCase()}
                </span>
              }
            >
              {t('properties.images.gallery')}
            </Card.Header>
            <ImageGallery
              propertyId={Number(id)}
              images={images}
              canDelete={canEdit}
              onDeleted={refreshImages}
            />
          </Card>

          {/* ── Videos section ─────────────────────────── */}
          <Card>
            <Card.Header
              actions={
                videos.length > 0
                  ? <span className="text-xs text-dark-400">
                      {videos.length} {t('properties.videos.gallery').toLowerCase()}
                    </span>
                  : null
              }
            >
              {t('properties.videos.gallery')}
            </Card.Header>
            <VideoGallery
              propertyId={Number(id)}
              videos={videos}
              canDelete={canEdit}
              onDeleted={refreshVideos}
            />
          </Card>

          {/* ── Description ────────────────────────────── */}
          {property.description && (
            <Card>
              <Card.Header>{t('common.description')}</Card.Header>
              <p className="text-sm text-dark-600 leading-relaxed whitespace-pre-wrap">
                {property.description}
              </p>
            </Card>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            Right column — price, details, owner, agent
        ══════════════════════════════════════════════════ */}
        <div className="space-y-5">

          {/* Price + listing badges + status change */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-2xl font-bold text-primary-800">{fmtPriceLocale(property.price, locale)}</p>
                <p className="text-xs text-dark-400 capitalize mt-0.5">
                  {t(`properties.paymentMethod.${property.payment_method}`) || property.payment_method}
                </p>
              </div>
              <PropertyStatusBadge status={property.status} />
            </div>

            <div className="flex gap-2 flex-wrap mb-4">
              <Badge variant="info" size="sm">
                {t(`properties.listingType.${property.listing_type}`) || property.listing_type}
              </Badge>
              {property.is_featured === 1 && (
                <Badge variant="secondary" size="sm">⭐ {t('common.active')}</Badge>
              )}
            </div>

            {canEdit && (
              <div>
                <label className="form-label text-xs">{t('common.status')}</label>
                <div className="relative">
                  <select
                    value={property.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={savingStatus}
                    className="input-base appearance-none pe-9 text-sm cursor-pointer"
                  >
                    {['available','reserved','sold','rented','off_market'].map((s) => (
                      <option key={s} value={s}>{t(`properties.status.${s}`)}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-dark-400">
                    {savingStatus ? (
                      <Spinner size="xs" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Property specifications */}
          <Card>
            <Card.Header>{t('properties.propertyDetails')}</Card.Header>
            <DetailRow label={t('common.type')}                value={property.type} />
            <DetailRow label={t('common.location')}            value={property.location} />
            <DetailRow label={t('properties.form.address')}    value={property.address} />
            <DetailRow label={t('properties.form.areaM2')}     value={property.area ? `${property.area} m²` : null} />
            <DetailRow label={t('properties.form.rooms')}      value={property.rooms} />
            <DetailRow label={t('properties.form.bedrooms')}   value={property.bedrooms} />
            <DetailRow label={t('properties.form.bathrooms')}  value={property.bathrooms} />
            <DetailRow
              label={t('properties.form.floor')}
              value={property.floor != null ? (property.floor === 0 ? t('properties.form.floorPlaceholder') : `${t('properties.form.floor')} ${property.floor}`) : null}
            />
          </Card>

          {/* Owner */}
          <Card>
            <Card.Header>{t('properties.form.ownerInfo')}</Card.Header>
            <DetailRow label={t('properties.form.ownerName')}  value={property.owner_name} />
            <DetailRow label={t('properties.form.ownerPhone')} value={property.owner_phone} />
          </Card>

          {/* Agent */}
          {property.agent_name && (
            <Card>
              <Card.Header>{t('customers.form.assignedTo')}</Card.Header>
              <DetailRow label={t('common.name')}  value={property.agent_name} />
              <DetailRow label={t('common.phone')} value={property.agent_phone} />
            </Card>
          )}

          {/* Media summary */}
          {(images.length > 0 || videos.length > 0) && (
            <Card>
              <Card.Header>{t('properties.images.gallery')} / {t('properties.videos.gallery')}</Card.Header>
              <div className="flex gap-4">
                {images.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-dark-600">
                    <svg className="w-4 h-4 text-primary-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                    </svg>
                    {images.length} {t('properties.images.gallery').toLowerCase()}
                  </div>
                )}
                {videos.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-dark-600">
                    <svg className="w-4 h-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    {videos.length} {t('properties.videos.gallery').toLowerCase()}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteMdl}
        onClose={() => setShowDeleteMdl(false)}
        onConfirm={handleDelete}
        title={t('properties.deleteConfirm.title')}
        message={t('properties.deleteConfirm.message')}
        confirmLabel={t('common.delete')}
        variant="danger"
        loading={deletingProp}
      />
    </div>
  );
}

export default PropertyDetailsPage;
