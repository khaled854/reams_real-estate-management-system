import useAuthStore from '../store/authStore';

/**
 * usePermissions
 * Centralised permission-checking hook.
 * Components call this to determine what UI to show/hide.
 *
 * Usage:
 *   const { isAdmin, can, role } = usePermissions();
 *   {can('manage_users') && <Link to="/users">Users</Link>}
 */

/**
 * Permission matrix — maps every action to the roles that can perform it.
 * Add new permissions here as modules are built.
 */
const PERMISSIONS = {
  // User management
  manage_users:        ['admin'],
  view_all_users:      ['admin'],

  // Properties
  create_property:     ['admin', 'manager', 'employee'],
  edit_any_property:   ['admin', 'manager'],
  edit_own_property:   ['admin', 'manager', 'employee'],
  delete_property:     ['admin', 'manager'],
  view_properties:     ['admin', 'manager', 'employee'],

  // Customers
  create_customer:     ['admin', 'manager', 'employee'],
  view_all_customers:  ['admin', 'manager'],
  view_own_customers:  ['admin', 'manager', 'employee'],
  assign_customer:     ['admin', 'manager'],
  delete_customer:     ['admin', 'manager'],

  // Contracts
  create_contract:     ['admin', 'manager', 'employee'],
  edit_contract:       ['admin', 'manager'],
  delete_contract:     ['admin'],
  view_contracts:      ['admin', 'manager', 'employee'],

  // Financials
  view_financials:     ['admin', 'manager'],
  record_payment:      ['admin', 'manager'],

  // Reports
  view_reports:        ['admin', 'manager', 'employee'],
  view_agent_report:   ['admin', 'manager'],
  view_financial_report: ['admin'],

  // Appointments
  view_appointments:   ['admin', 'manager', 'employee'],
  create_appointment:  ['admin', 'manager', 'employee'],
  manage_appointments: ['admin', 'manager'],
  delete_appointment:  ['admin'],

  // System settings
  view_settings:       ['admin'],
  manage_settings:     ['admin'],
};

function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? null;

  const isAdmin    = role === 'admin';
  const isManager  = role === 'manager';
  const isEmployee = role === 'employee';

  /**
   * can(permission) — returns true if the current user's role
   * is in the permission's allowed list.
   */
  const can = (permission) => {
    if (!role) return false;
    const allowed = PERMISSIONS[permission];
    if (!allowed) return false;
    return allowed.includes(role);
  };

  /**
   * canAny(...permissions) — true if the user has at least one.
   */
  const canAny = (...permissions) => permissions.some((p) => can(p));

  /**
   * canAll(...permissions) — true only if the user has all of them.
   */
  const canAll = (...permissions) => permissions.every((p) => can(p));

  return { role, isAdmin, isManager, isEmployee, can, canAny, canAll };
}

export default usePermissions;
