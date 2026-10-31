import api from './api';

const BASE = '/v1/customers';

/** GET /api/v1/customers/pipeline — lead counts by status */
export const getCustomerPipeline = async () => {
  const res = await api.get(`${BASE}/pipeline`);
  return res.data.data; // [{ status, count }]
};

/** GET /api/v1/customers — paginated list with filters */
export const getCustomers = async (params = {}) => {
  const res = await api.get(BASE, { params });
  return res.data; // { success, data: [], meta }
};

/** GET /api/v1/customers/:id */
export const getCustomer = async (id) => {
  const res = await api.get(`${BASE}/${id}`);
  return res.data.data;
};

/** POST /api/v1/customers */
export const createCustomer = async (payload) => {
  const res = await api.post(BASE, payload);
  return res.data.data;
};

/** PUT /api/v1/customers/:id */
export const updateCustomer = async (id, payload) => {
  const res = await api.put(`${BASE}/${id}`, payload);
  return res.data.data;
};

/** PATCH /api/v1/customers/:id/status */
export const updateCustomerStatus = async (id, status) => {
  const res = await api.patch(`${BASE}/${id}/status`, { status });
  return res.data.data;
};

/** PATCH /api/v1/customers/:id/assign — admin only */
export const assignCustomer = async (id, employee_id) => {
  const res = await api.patch(`${BASE}/${id}/assign`, { employee_id });
  return res.data.data;
};

/** DELETE /api/v1/customers/:id */
export const deleteCustomer = async (id) => {
  const res = await api.delete(`${BASE}/${id}`);
  return res.data;
};
