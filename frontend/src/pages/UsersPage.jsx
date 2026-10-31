import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Badge from '../components/common/Badge';
import Modal, { ConfirmModal } from '../components/common/Modal';
import { Pagination } from '../components/common/Table';
import usePermissions from '../hooks/usePermissions';
import {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deactivateUser,
  activateUser,
  deleteUser,
} from '../services/userService';

/* ── Role badge ───────────────────────────────────────────── */
const ROLE_VARIANT = { admin: 'danger', manager: 'warning', employee: 'info' };

function RoleBadge({ role }) {
  return (
    <Badge variant={ROLE_VARIANT[role] ?? 'dark'} size="sm">
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  );
}

/* ── Status badge ─────────────────────────────────────────── */
function StatusBadge({ active }) {
  return active ? (
    <Badge variant="success" size="sm" dot>Active</Badge>
  ) : (
    <Badge variant="dark" size="sm" dot>Inactive</Badge>
  );
}

/* ── Empty form state ─────────────────────────────────────── */
function emptyForm() {
  return { name: '', email: '', password: '', role: 'employee', phone: '' };
}

/* ── User form modal (add / edit) ─────────────────────────── */
function UserFormModal({ isOpen, onClose, onSaved, editUser }) {
  const isEdit = Boolean(editUser);
  const [form, setForm]       = useState(emptyForm());
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (isOpen) {
      if (editUser) {
        setForm({
          name:     editUser.name ?? '',
          email:    editUser.email ?? '',
          password: '',           // never pre-fill password
          role:     editUser.role ?? 'employee',
          phone:    editUser.phone ?? '',
        });
      } else {
        setForm(emptyForm());
      }
      setErrors({});
    }
  }, [isOpen, editUser]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim())                              errs.name     = 'Name is required';
    if (!form.email.trim())                             errs.email    = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                                        errs.email    = 'Enter a valid email';
    if (!isEdit && !form.password)                      errs.password = 'Password is required';
    if (!isEdit && form.password && form.password.length < 8)
                                                        errs.password = 'Minimum 8 characters';
    if (!['admin','manager','employee'].includes(form.role))
                                                        errs.role     = 'Select a valid role';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name:  form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role:  form.role,
        phone: form.phone.trim() || undefined,
      };
      if (!isEdit) payload.password = form.password;

      if (isEdit) {
        await updateUser(editUser.id, payload);
        toast.success('User updated');
      } else {
        await createUser(payload);
        toast.success('User created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header onClose={onClose}>{isEdit ? 'Edit User' : 'Add User'}</Modal.Header>
      <form onSubmit={handleSubmit} noValidate>
        <Modal.Body className="space-y-4">

          {/* Name */}
          <div>
            <label className="form-label">Full Name <span className="text-danger">*</span></label>
            <input
              type="text"
              className={clsx('input-base', errors.name && 'input-error')}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Sara Ali"
              autoFocus
            />
            {errors.name && <p className="form-error">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="form-label">Email <span className="text-danger">*</span></label>
            <input
              type="email"
              className={clsx('input-base', errors.email && 'input-error')}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="user@company.local"
              autoComplete="off"
            />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>

          {/* Password — required on create, hidden on edit */}
          {!isEdit && (
            <div>
              <label className="form-label">Password <span className="text-danger">*</span></label>
              <input
                type="password"
                className={clsx('input-base', errors.password && 'input-error')}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              {errors.password && <p className="form-error">{errors.password}</p>}
              <p className="text-2xs text-dark-400 mt-1">
                Must contain uppercase, lowercase, and a number.
              </p>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="form-label">Role <span className="text-danger">*</span></label>
            <select
              className={clsx('input-base', errors.role && 'input-error')}
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && <p className="form-error">{errors.role}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="form-label">Phone <span className="text-dark-400 font-normal">(optional)</span></label>
            <input
              type="tel"
              className="input-base"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+966 5x xxx xxxx"
            />
          </div>

        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

/* ── Reset password modal ─────────────────────────────────── */
function ResetPasswordModal({ isOpen, onClose, user }) {
  const [pw,      setPw]      = useState('');
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (isOpen) { setPw(''); setError(''); }
  }, [isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pw)           return setError('Password is required');
    if (pw.length < 8) return setError('Minimum 8 characters');
    setSaving(true);
    try {
      await resetUserPassword(user.id, pw);
      toast.success(`Password reset for ${user.name}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header onClose={onClose}>Reset Password</Modal.Header>
      <form onSubmit={handleSubmit} noValidate>
        <Modal.Body className="space-y-3">
          <p className="text-sm text-dark-500">
            Set a new password for <strong>{user?.name}</strong>.
          </p>
          <div>
            <label className="form-label">New Password <span className="text-danger">*</span></label>
            <input
              type="password"
              className={clsx('input-base', error && 'input-error')}
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(''); }}
              placeholder="Min. 8 characters"
              autoFocus
              autoComplete="new-password"
            />
            {error && <p className="form-error">{error}</p>}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>Reset Password</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

/* ── Main UsersPage ───────────────────────────────────────── */
function UsersPage() {
  const { can } = usePermissions();

  // Data state
  const [users,     setUsers]     = useState([]);
  const [meta,      setMeta]      = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading,   setLoading]   = useState(false);

  // Filter state
  const [search,    setSearch]    = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page,      setPage]      = useState(1);

  // Modal state
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [confirmDelete,     setConfirmDelete]     = useState(null);
  const [actionLoading,     setActionLoading]     = useState(false);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search)       params.search    = search;
      if (roleFilter)   params.role      = roleFilter;
      if (activeFilter !== '') params.is_active = activeFilter;
      const res = await getUsers(params);
      setUsers(res.data);
      setMeta(res.meta);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, activeFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Actions ────────────────────────────────────────────────
  function openAdd()  { setEditTarget(null); setShowForm(true); }
  function openEdit(u) { setEditTarget(u);   setShowForm(true); }

  async function handleToggleActive(user) {
    setConfirmDeactivate(user);
  }

  async function doToggleActive() {
    const user = confirmDeactivate;
    setActionLoading(true);
    try {
      if (user.is_active) {
        await deactivateUser(user.id);
        toast.success(`${user.name} deactivated`);
      } else {
        await activateUser(user.id);
        toast.success(`${user.name} activated`);
      }
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Action failed');
    } finally {
      setActionLoading(false);
      setConfirmDeactivate(null);
    }
  }

  async function doDelete() {
    setActionLoading(true);
    try {
      await deleteUser(confirmDelete.id);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Delete failed');
    } finally {
      setActionLoading(false);
      setConfirmDelete(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${meta.total} user${meta.total !== 1 ? 's' : ''} total`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }]}
        actions={
          can('manage_users') && (
            <Button
              onClick={openAdd}
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              Add User
            </Button>
          )
        }
      />

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="card mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 left-3 flex items-center text-dark-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search name or email…"
            className="input-base pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Role filter */}
        <select
          className="input-base w-36"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
        </select>

        {/* Status filter */}
        <select
          className="input-base w-36"
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        {/* Clear */}
        {(search || roleFilter || activeFilter !== '') && (
          <button
            className="btn-ghost btn-sm text-danger"
            onClick={() => { setSearch(''); setRoleFilter(''); setActiveFilter(''); setPage(1); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      {loading && users.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="xl" />
        </div>
      ) : users.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-primary-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-dark-700">No users found</p>
          <p className="text-sm text-dark-400 mt-1">Try adjusting your filters or add a new user.</p>
          {can('manage_users') && (
            <Button onClick={openAdd} className="mt-5" size="sm">Add First User</Button>
          )}
        </div>
      ) : (
        <div className={clsx('table-wrapper bg-white', loading && 'opacity-60 pointer-events-none')}>
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  canManage={can('manage_users')}
                  onEdit={() => openEdit(user)}
                  onResetPw={() => setResetTarget(user)}
                  onToggleActive={() => handleToggleActive(user)}
                  onDelete={() => setConfirmDelete(user)}
                />
              ))}
            </tbody>
          </table>

          {meta.totalPages > 1 && (
            <Pagination
              page={meta.page}
              total={meta.total}
              limit={meta.limit}
              onChange={(p) => setPage(p)}
            />
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────── */}

      {/* Add / Edit */}
      <UserFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSaved={fetchUsers}
        editUser={editTarget}
      />

      {/* Reset password */}
      {resetTarget && (
        <ResetPasswordModal
          isOpen={Boolean(resetTarget)}
          onClose={() => setResetTarget(null)}
          user={resetTarget}
        />
      )}

      {/* Deactivate / activate confirm */}
      <ConfirmModal
        isOpen={Boolean(confirmDeactivate)}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={doToggleActive}
        title={confirmDeactivate?.is_active ? 'Deactivate User' : 'Activate User'}
        message={
          confirmDeactivate?.is_active
            ? `Deactivate ${confirmDeactivate?.name}? They will no longer be able to log in.`
            : `Reactivate ${confirmDeactivate?.name}? They will regain access to the system.`
        }
        confirmLabel={confirmDeactivate?.is_active ? 'Deactivate' : 'Activate'}
        variant={confirmDeactivate?.is_active ? 'danger' : 'primary'}
        loading={actionLoading}
      />

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete User"
        message={`Permanently delete ${confirmDelete?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}

/* ── Table row (extracted to keep JSX readable) ───────────── */
function UserRow({ user, canManage, onEdit, onResetPw, onToggleActive, onDelete }) {
  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <tr className="border-b border-dark-50 hover:bg-primary-50/30 transition-colors">
      {/* Avatar + name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {user.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <p className="text-sm font-medium text-dark-800">{user.name}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-dark-600">{user.email}</td>
      <td className="px-4 py-3 text-sm text-dark-500">{user.phone || '—'}</td>
      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
      <td className="px-4 py-3"><StatusBadge active={Boolean(user.is_active)} /></td>
      <td className="px-4 py-3 text-sm text-dark-500 whitespace-nowrap">{joinedDate}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {canManage && (
            <>
              <button onClick={onEdit}            className="btn-outline btn-xs">Edit</button>
              <button onClick={onResetPw}         className="btn-ghost btn-xs">Reset PW</button>
              <button onClick={onToggleActive}    className="btn-ghost btn-xs">
                {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={onDelete}          className="btn-danger btn-xs">Delete</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default UsersPage;
