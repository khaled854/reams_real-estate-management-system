import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import PropertyStatusBadge from './PropertyStatusBadge';
import usePermissions from '../../../hooks/usePermissions';
import { getImageUrl } from '../../../utils/imageUrl';
import { useI18n } from '../../../i18n';

function PropertyCard({ property, onDelete, deleting }) {
  const navigate = useNavigate();
  const { isAdmin, can } = usePermissions();
  const { t, language } = useI18n();

  const locale = language === 'ar' ? 'ar-EG' : 'en-US';

  function fmtPrice(n) {
    if (!n && n !== 0) return '—';
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: 'SAR', minimumFractionDigits: 0,
    }).format(n);
  }

  const coverUrl = getImageUrl(property.cover_image);

  // Listing type label from i18n
  const listingLabel = {
    sale: t('properties.listingType.sale'),
    rent: t('properties.listingType.rent'),
    both: t('properties.listingType.both'),
  }[property.listing_type] ?? '';

  return (
    <div className="bg-white rounded-xl shadow-card border border-dark-100 overflow-hidden flex flex-col transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5">
      {/* Image */}
      <div
        className="relative h-48 bg-dark-100 cursor-pointer overflow-hidden"
        onClick={() => navigate(`/properties/${property.id}`)}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-dark-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-2.5 start-2.5 flex flex-col gap-1.5">
          <PropertyStatusBadge status={property.status} size="sm" />
          {property.is_featured === 1 && (
            <span className="badge bg-secondary-500 text-white text-2xs px-2 py-0.5">
              ⭐ {t('common.active')}
            </span>
          )}
        </div>

        <div className="absolute bottom-2.5 end-2.5">
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-dark-800/70 text-white">
            {listingLabel}
          </span>
        </div>

        {property.image_count > 0 && (
          <div className="absolute bottom-2.5 start-2.5 flex items-center gap-1 bg-dark-800/70 text-white text-2xs px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
            </svg>
            {property.image_count}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4">
        <div className="flex-1 cursor-pointer" onClick={() => navigate(`/properties/${property.id}`)}>
          <p className="text-xs text-secondary-500 font-semibold mb-0.5">{property.type}</p>
          <h3 className="text-sm font-semibold text-dark-800 line-clamp-2 leading-snug mb-2">{property.title}</h3>

          <div className="flex items-center gap-1 text-xs text-dark-500 mb-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="truncate">{property.location}</span>
          </div>

          <div className="flex gap-3 text-xs text-dark-500 mb-3">
            {property.area && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                {property.area} m²
              </span>
            )}
            {property.rooms && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                {property.rooms} {t('properties.form.rooms').toLowerCase()}
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-dark-100 pt-3 mt-auto">
          <p className="text-lg font-bold text-primary-800">{fmtPrice(property.price)}</p>
          <p className="text-xs text-dark-400 capitalize">
            {t(`properties.paymentMethod.${property.payment_method}`) || property.payment_method}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-dark-100 px-4 py-2.5 flex items-center justify-between gap-2">
        <button onClick={() => navigate(`/properties/${property.id}`)} className="btn-ghost btn-xs">
          {t('common.view')}
        </button>
        {can('edit_own_property') && (
          <button onClick={() => navigate(`/properties/${property.id}/edit`)} className="btn-outline btn-xs">
            {t('common.edit')}
          </button>
        )}
        {(isAdmin || can('delete_property')) && (
          <button onClick={() => onDelete(property.id)} disabled={deleting} className="btn-danger btn-xs">
            {deleting ? '…' : t('common.delete')}
          </button>
        )}
      </div>
    </div>
  );
}

export default PropertyCard;
