import api from './api';

const BASE = '/v1/users';

/** GET /api/v1/users — paginated list, filterable by role/status/search */
export const getUsers = async (params = {}) => {
  const res = await api.get(BASE, { params });
  return res.data; // { success, data: [], meta: { total, page, limit, totalPages } }
};

/** GET /api/v1/users/:id */
export const getUser = async (id) => {
  const res = await api.get(`${BASE}/${id}`);
  return res.data.data;
};

/** POST /api/v1/users — create new user */
export const createUser = async (payload) => {
  const res = await api.post(BASE, payload);
  return res.data.data;
};

/** PUT /api/v1/users/:id — update profile / role */
export const updateUser = async (id, payload) => {
  const res = await api.put(`${BASE}/${id}`, payload);
  return res.data.data;
};

/** PATCH /api/v1/users/:id/password — admin resets any user's password */
export const resetUserPassword = async (id, password) => {
  const res = await api.patch(`${BASE}/${id}/password`, { password });
  return res.data;
};

/** PATCH /api/v1/users/:id/deactivate — soft-disable account */
export const deactivateUser = async (id) => {
  const res = await api.patch(`${BASE}/${id}/deactivate`);
  return res.data;
};

/** PATCH /api/v1/users/:id/activate — re-enable account */
export const activateUser = async (id) => {
  const res = await api.patch(`${BASE}/${id}/activate`);
  return res.data;
};

/** DELETE /api/v1/users/:id — permanently delete user */
export const deleteUser = async (id) => {
  const res = await api.delete(`${BASE}/${id}`);
  return res.data;
};
