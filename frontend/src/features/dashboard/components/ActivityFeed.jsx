import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import Spinner from '../../../components/common/Spinner';

/**
 * ActivityFeed
 * Pulls the latest activity records and renders a timeline.
 * Uses the activities table via a dedicated endpoint that will be
 * wired when the activity API route is exposed.
 * Falls back gracefully if the endpoint is unavailable.
 */

const ACTION_CONFIG = {
  'property.created':       { label: 'Property added',       color: 'bg-primary-800',   entity: 'properties' },
  'property.updated':       { label: 'Property updated',     color: 'bg-info',           entity: 'properties' },
  'property.deleted':       { label: 'Property deleted',     color: 'bg-danger',         entity: null },
  'property.status_changed':{ label: 'Property status',      color: 'bg-warning',        entity: 'properties' },
  'property.images_uploaded':{ label: 'Images uploaded',     color: 'bg-primary-400',   entity: 'properties' },
  'property.image_deleted': { label: 'Image removed',        color: 'bg-dark-400',       entity: null },
  'customer.created':       { label: 'Customer added',       color: 'bg-secondary-500', entity: 'customers' },
  'customer.updated':       { label: 'Customer updated',     color: 'bg-info',           entity: 'customers' },
  'customer.status_changed':{ label: 'Customer status',      color: 'bg-warning',        entity: 'customers' },
  'customer.assigned':      { label: 'Customer assigned',    color: 'bg-success',        entity: 'customers' },
  'customer.deleted':       { label: 'Customer deleted',     color: 'bg-danger',         entity: null },
  'user.login':             { label: 'User logged in',       color: 'bg-dark-400',       entity: null },
  'user.logout':            { label: 'User logged out',      color: 'bg-dark-300',       entity: null },
  'user.registered':        { label: 'User registered',      color: 'bg-success',        entity: null },
  'user.password_changed':  { label: 'Password changed',     color: 'bg-warning',        entity: null },
  'contract.created':       { label: 'Contract created',     color: 'bg-primary-800',   entity: null },
  'contract.signed':        { label: 'Contract signed',      color: 'bg-success',        entity: null },
  'financial.recorded':     { label: 'Payment recorded',     color: 'bg-secondary-500', entity: null },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return 'Just now';
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr  < 24)  return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7)  return `${days}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
}

function ActivityFeed({ limit = 10 }) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to fetch activities; silently fall back if unavailable
    api.get('/v1/activities', { params: { limit, page: 1 } })
      .then((res) => setActivities(res.data?.data || []))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="skeleton w-2 h-2 rounded-full mt-2 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-2.5 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-10 h-10 text-dark-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-dark-400">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-dark-100" />

      <div className="space-y-4">
        {activities.map((act) => {
          const cfg     = ACTION_CONFIG[act.action] ?? { label: act.action, color: 'bg-dark-400', entity: null };
          const canNav  = cfg.entity && act.entity_id;

          return (
            <div key={act.id} className="flex items-start gap-3 pl-0.5">
              {/* Dot */}
              <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 ring-2 ring-white ${cfg.color}`} />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-dark-700 leading-snug">
                  <span className="font-medium">{cfg.label}</span>
                  {act.description && (
                    <span className="text-dark-500">: {act.description}</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-dark-400">{timeAgo(act.created_at)}</span>
                  {canNav && (
                    <button
                      onClick={() => navigate(`/${cfg.entity}/${act.entity_id}`)}
                      className="text-xs text-primary-800 hover:underline"
                    >
                      View →
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActivityFeed;
