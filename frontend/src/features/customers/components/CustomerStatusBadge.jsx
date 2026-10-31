import Badge from '../../../components/common/Badge';
import { useI18n } from '../../../i18n';

const STATUS_VARIANT = {
  new:         'info',
  contacted:   'primary',
  interested:  'warning',
  negotiating: 'secondary',
  closed:      'success',
  lost:        'danger',
};

function CustomerStatusBadge({ status, size = 'md' }) {
  const { t } = useI18n();
  const variant = STATUS_VARIANT[status] ?? 'outline';
  const label   = status ? t(`customers.status.${status}`) : '—';
  return (
    <Badge variant={variant} size={size} dot>
      {label}
    </Badge>
  );
}

export default CustomerStatusBadge;
