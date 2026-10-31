import api from './api';

const BASE = '/v1/reports';

/** GET /api/v1/reports/dashboard — single-row KPI snapshot */
export const getDashboardStats = async () => {
  const res = await api.get(`${BASE}/dashboard`);
  return res.data.data;
};

/** GET /api/v1/reports/properties — byStatus, byType, byListingType, monthly */
export const getPropertiesReport = async (params = {}) => {
  const res = await api.get(`${BASE}/properties`, { params });
  return res.data.data;
};

/** GET /api/v1/reports/customers — byStatus, byEmployee, monthly */
export const getCustomersReport = async (params = {}) => {
  const res = await api.get(`${BASE}/customers`, { params });
  return res.data.data;
};

/** GET /api/v1/reports/financials — byType, monthly revenue, totals (admin only) */
export const getFinancialsReport = async (params = {}) => {
  const res = await api.get(`${BASE}/financials`, { params });
  return res.data.data;
};

/** GET /api/v1/reports/agents — per-agent performance table (admin only) */
export const getAgentsReport = async (params = {}) => {
  const res = await api.get(`${BASE}/agents`, { params });
  return res.data.data;
};
