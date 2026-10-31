'use strict';

const reportModel  = require('../models/reportModel');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

/* ── GET /api/v1/reports/dashboard ───────────────────────── */
const getDashboard = asyncHandler(async (_req, res) => {
  const stats = await reportModel.getDashboardStats();
  sendSuccess(res, { data: stats });
});

/* ── GET /api/v1/reports/properties ──────────────────────── */
const getPropertiesReport = asyncHandler(async (req, res) => {
  const data = await reportModel.getPropertiesSummary({
    from_date: req.query.from_date || undefined,
    to_date:   req.query.to_date   || undefined,
    agent_id:  req.query.agent_id  ? parseInt(req.query.agent_id) : undefined,
  });
  sendSuccess(res, { data });
});

/* ── GET /api/v1/reports/customers ───────────────────────── */
const getCustomersReport = asyncHandler(async (req, res) => {
  const data = await reportModel.getCustomersSummary({
    from_date:   req.query.from_date   || undefined,
    to_date:     req.query.to_date     || undefined,
    employee_id: req.query.employee_id
                   ? parseInt(req.query.employee_id)
                   : undefined,
  });
  sendSuccess(res, { data });
});

/* ── GET /api/v1/reports/financials ──────────────────────── */
const getFinancialsReport = asyncHandler(async (req, res) => {
  const data = await reportModel.getFinancialSummary({
    from_date: req.query.from_date || undefined,
    to_date:   req.query.to_date   || undefined,
  });
  sendSuccess(res, { data });
});

/* ── GET /api/v1/reports/agents ──────────────────────────── */
const getAgentPerformance = asyncHandler(async (req, res) => {
  const data = await reportModel.getAgentPerformance({
    from_date: req.query.from_date || undefined,
    to_date:   req.query.to_date   || undefined,
  });
  sendSuccess(res, { data });
});

module.exports = {
  getDashboard,
  getPropertiesReport,
  getCustomersReport,
  getFinancialsReport,
  getAgentPerformance,
};
