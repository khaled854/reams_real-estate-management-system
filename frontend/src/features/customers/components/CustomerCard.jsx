import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import CustomerStatusBadge from './CustomerStatusBadge';
import usePermissions from '../../../hooks/usePermissions';

function fmtBudget(n) {
  if (!n && n !== 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'SAR', minimumFractionDigits: 0,
  }).format(n);
}

/** Single letter avatar with deterministic color */
const AVATAR_COLORS = [
  'bg-primary-800', 'bg-secondary-500', 'bg-success',
  'bg-info', 'bg-warning', 'bg-dark-600',
];
function avatarColor(name = '') {
  let hash = 0;
  for (const c of name) hash += c.charCodeAt(0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * CustomerCard
 * Grid card for a single CRM lead / customer.
 */
function CustomerCard({ customer, onDelete, onStatusChange, deleting }) {
  const navigate      = useNavigate();
  const { isAdmin, can } = usePermissions();

  const initials = customer.name
    .trim().split(/\s+/)
    .slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  return (
    <div className="bg-white rounded-xl border border-dark-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden">
      {/* Top accent strip by status */}
      <div className={clsx('h-1 w-full', {
        'bg-info':      customer.status === 'new',
        'bg-primary-800': customer.status === 'contacted',
        'bg-warning':   customer.status === 'interested',
        'bg-secondary-500': customer.status === 'negotiating',
        'bg-success':   customer.status === 'closed',
        'bg-danger':    customer.status === 'lost',
      })} />

      <div className="p-5 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0',
              avatarColor(customer.name)
            )}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold text-dark-800 truncate cursor-pointer hover:text-primary-800 transition-colors"
              onClick={() => navigate(`/customers/${customer.id}`)}
            >
              {customer.name}
            </p>
            <p className="text-xs text-dark-500 mt-0.5">{customer.phone}</p>
          </div>
          <CustomerStatusBadge status={customer.status} size="sm" />
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-xs text-dark-500 flex-1 mb-4">
          {customer.email && (
            <div className="flex items-center gap-1.5 truncate">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <span className="truncate">{customer.email}</span>
            </div>
          )}
          {customer.property_type && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              <span>{customer.property_type}</span>
            </div>
          )}
          {customer.location && (
            <div className="flex items-center gap-1.5 truncate">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span className="truncate">{customer.location}</span>
            </div>
          )}
          {(customer.budget || customer.budget_min) && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {customer.budget_min ? `${fmtBudget(customer.budget_min)} – ` : ''}
                {fmtBudget(customer.budget)}
              </span>
            </div>
          )}
        </div>

        {/* Employee tag */}
        {customer.employee_name && (
          <div className="mb-3">
            <span className="text-2xs bg-primary-50 text-primary-800 font-medium px-2 py-0.5 rounded-full">
              {customer.employee_name}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-dark-50 pt-3 flex items-center gap-2">
          <button
            onClick={() => navigate(`/customers/${customer.id}`)}
            className="btn-ghost btn-xs flex-1"
          >
            View
          </button>
          {can('create_customer') && (
            <button
              onClick={() => navigate(`/customers/${customer.id}/edit`)}
              className="btn-outline btn-xs"
            >
              Edit
            </button>
          )}
          {(isAdmin || can('delete_customer')) && (
            <button
              onClick={() => onDelete(customer.id)}
              disabled={deleting}
              className="btn-danger btn-xs"
            >
              {deleting ? '…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerCard;
