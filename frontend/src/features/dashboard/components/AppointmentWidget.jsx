import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import Card from '../../../components/common/Card';

/**
 * AppointmentWidget
 * Compact appointment summary for the main dashboard.
 * Shows today / pending / upcoming / confirmed / completed counts.
 * Clicking any cell navigates to the filtered appointments list.
 */

function StatCell({ label, value, variant, onClick, loading }) {
  const variantClasses = {
    warning:  'bg-warning-light   text-warning   border-warning/20',
    success:  'bg-success-light   text-success   border-success/20',
    primary:  'bg-primary-50      text-primary-800 border-primary-100',
    info:     'bg-info-light      text-info      border-info/20',
    secondary:'bg-dark-50         text-dark-500  border-dark-100',
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center justify-center p-3 rounded-xl border text-center',
        'hover:scale-[1.03] active:scale-[0.98] transition-transform duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-800/40',
        variantClasses[variant] ?? variantClasses.secondary
      )}
    >
      {loading ? (
        <div className="skeleton h-7 w-8 rounded mx-auto mb-1" />
      ) : (
        <span className="text-2xl font-bold leading-none">{value ?? '–'}</span>
      )}
      <span className="text-2xs font-medium mt-1 leading-tight opacity-80">{label}</span>
    </button>
  );
}

function AppointmentWidget({ stats, loading }) {
  const navigate = useNavigate();

  // stats may be null while loading or if the appointments table isn't migrated yet
  const s = stats ?? {};

  return (
    <Card padding={false}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-dark-50">
        <div>
          <h3 className="text-base font-semibold text-dark-800">Appointments</h3>
          <p className="text-xs text-dark-400 mt-0.5">Viewing requests &amp; bookings</p>
        </div>
        <button
          onClick={() => navigate('/appointments')}
          className="text-xs text-primary-800 font-semibold hover:underline"
        >
          View all →
        </button>
      </div>

      {/* Stats grid */}
      <div className="p-4 grid grid-cols-3 sm:grid-cols-5 gap-2.5">
        <StatCell
          label="Today"
          value={s.today}
          variant="primary"
          loading={loading}
          onClick={() => navigate(`/appointments?date_from=${new Date().toISOString().split('T')[0]}`)}
        />
        <StatCell
          label="Pending"
          value={s.pending}
          variant="warning"
          loading={loading}
          onClick={() => navigate('/appointments?status=pending')}
        />
        <StatCell
          label="Confirmed"
          value={s.confirmed}
          variant="success"
          loading={loading}
          onClick={() => navigate('/appointments?status=confirmed')}
        />
        <StatCell
          label="Upcoming"
          value={s.upcoming}
          variant="info"
          loading={loading}
          onClick={() => navigate('/appointments?status=confirmed')}
        />
        <StatCell
          label="Completed"
          value={s.completed}
          variant="secondary"
          loading={loading}
          onClick={() => navigate('/appointments?status=completed')}
        />
      </div>

      {/* Pending CTA — shown when there are unreviewed bookings */}
      {!loading && (s.pending ?? 0) > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => navigate('/appointments?status=pending')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-warning-light border border-warning/30 text-warning
                       text-sm font-semibold hover:bg-warning/20 transition-colors"
          >
            <span className="animate-pulse">🔔</span>
            {s.pending} pending appointment{s.pending !== 1 ? 's' : ''} awaiting review
          </button>
        </div>
      )}
    </Card>
  );
}

export default AppointmentWidget;
