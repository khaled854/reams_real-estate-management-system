import Badge from '../../../components/common/Badge';
import { STATUS_VARIANT } from '../../../services/appointmentService';
import { useI18n } from '../../../i18n';

function AppointmentStatusBadge({ status, size = 'md', dot = false }) {
  const { t } = useI18n();
  if (!status) return null;
  const label = t(`appointments.status.${status}`) || status;
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'secondary'} size={size} dot={dot}>
      {label}
    </Badge>
  );
}

export default AppointmentStatusBadge;
