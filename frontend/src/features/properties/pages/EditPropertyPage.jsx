import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/common/PageHeader';
import Card from '../../../components/common/Card';
import Spinner from '../../../components/common/Spinner';
import PropertyForm from '../components/PropertyForm';
import ImageGallery from '../components/ImageGallery';
import ImageUploader from '../components/ImageUploader';
import VideoGallery from '../components/VideoGallery';
import VideoUploader from '../components/VideoUploader';
import {
  getProperty, updateProperty,
  getPropertyImages, getPropertyVideos,
} from '../../../services/propertyService';
import usePermissions from '../../../hooks/usePermissions';
import useAuthStore from '../../../store/authStore';
import { useI18n } from '../../../i18n';

const MAX_IMAGES = 10;
const MAX_VIDEOS = 5;

function EditPropertyPage() {
  const navigate         = useNavigate();
  const { id }           = useParams();
  const { user }         = useAuthStore();
  const { isAdmin, can } = usePermissions();
  const { t }            = useI18n();

  const [property, setProperty] = useState(null);
  const [images,   setImages]   = useState([]);
  const [videos,   setVideos]   = useState([]);
  const [pageLoad, setPageLoad] = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prop, imgs, vids] = await Promise.all([
          getProperty(id),
          getPropertyImages(id),
          getPropertyVideos(id),
        ]);
        if (!isAdmin && prop.agent_id !== user?.id) {
          toast.error(t('toast.actionFailed'));
          navigate('/properties');
          return;
        }
        setProperty(prop);
        setImages(imgs);
        setVideos(vids);
      } catch (err) {
        toast.error(err.response?.data?.message || t('toast.loadFailed'));
        navigate('/properties');
      } finally {
        setPageLoad(false);
      }
    })();
  }, [id]); // eslint-disable-line

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      await updateProperty(id, payload);
      toast.success(t('toast.propertyUpdated'));
      navigate(`/properties/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const refreshImages = async () => { setImages(await getPropertyImages(id)); };
  const refreshVideos = async () => { setVideos(await getPropertyVideos(id)); };

  if (pageLoad) return <div className="flex items-center justify-center py-24"><Spinner size="xl" /></div>;
  if (!property) return null;

  const initialValues = {
    type_id:        property.type_id        ?? '',
    type:           property.type           ?? '',
    title:          property.title          ?? '',
    description:    property.description    ?? '',
    location:       property.location       ?? '',
    address:        property.address        ?? '',
    area:           property.area           ?? '',
    rooms:          property.rooms     != null ? String(property.rooms)     : '',
    bedrooms:       property.bedrooms  != null ? String(property.bedrooms)  : '',
    bathrooms:      property.bathrooms != null ? String(property.bathrooms) : '',
    floor:          property.floor     != null ? String(property.floor)     : '',
    price:          property.price          ?? '',
    payment_method: property.payment_method ?? 'cash',
    owner_name:     property.owner_name     ?? '',
    owner_phone:    property.owner_phone    ?? '',
    listing_type:   property.listing_type   ?? 'sale',
    status:         property.status         ?? 'available',
    is_featured:    Boolean(property.is_featured),
  };

  const canEditMedia = isAdmin || can('edit_own_property');

  return (
    <div>
      <PageHeader
        title={t('properties.editProperty')}
        subtitle={property.title}
        breadcrumbs={[
          { label: t('breadcrumbs.dashboard'),  href: '/dashboard' },
          { label: t('breadcrumbs.properties'), href: '/properties' },
          { label: property.title, href: `/properties/${id}` },
          { label: t('breadcrumbs.edit') },
        ]}
      />

      <div className="max-w-3xl space-y-6">
        {/* ── Details ───────────────────────────────────────── */}
        <Card>
          <Card.Header>{t('properties.form.step1')}</Card.Header>
          <PropertyForm
            initialValues={initialValues}
            onSubmit={handleSave}
            loading={saving}
            submitLabel={t('common.save')}
          />
        </Card>

        {/* ── Photos ────────────────────────────────────────── */}
        <Card>
          <Card.Header
            actions={
              <span className="text-xs text-dark-400">
                {images.length} / {MAX_IMAGES} {t('properties.images.gallery').toLowerCase()}
              </span>
            }
          >
            {t('properties.form.step2')}
          </Card.Header>
          <div className="space-y-5">
            {images.length > 0 && (
              <ImageGallery
                propertyId={Number(id)}
                images={images}
                canDelete={canEditMedia}
                onDeleted={refreshImages}
              />
            )}
            {images.length < MAX_IMAGES && (
              <ImageUploader
                propertyId={Number(id)}
                onUploaded={refreshImages}
                existingCount={images.length}
              />
            )}
          </div>
        </Card>

        {/* ── Videos ────────────────────────────────────────── */}
        <Card>
          <Card.Header
            actions={
              <span className="text-xs text-dark-400">
                {videos.length} / {MAX_VIDEOS} {t('properties.videos.gallery').toLowerCase()}
              </span>
            }
          >
            {t('properties.form.step3')}
          </Card.Header>
          <div className="space-y-5">
            {videos.length > 0 && (
              <VideoGallery
                propertyId={Number(id)}
                videos={videos}
                canDelete={canEditMedia}
                onDeleted={refreshVideos}
              />
            )}
            {videos.length < MAX_VIDEOS && (
              <VideoUploader
                propertyId={Number(id)}
                onUploaded={refreshVideos}
                existingCount={videos.length}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default EditPropertyPage;
