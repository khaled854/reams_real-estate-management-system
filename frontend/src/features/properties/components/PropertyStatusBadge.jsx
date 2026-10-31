import Badge from '../../../components/common/Badge';
import { useI18n } from '../../../i18n';

const STATUS_VARIANT = {
  available:  'success',
  reserved:   'warning',
  sold:       'dark',
  rented:     'info',
  off_market: 'secondary',
};

function PropertyStatusBadge({ status, size = 'md' }) {
  const { t } = useI18n();
  const variant = STATUS_VARIANT[status] ?? 'outline';
  const label   = status ? t(`properties.status.${status}`) : '—';
  return (
    <Badge variant={variant} size={size} dot>
      {label}
    </Badge>
  );
}

export default PropertyStatusBadge;
