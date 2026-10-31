import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getCustomers,
  getCustomerPipeline,
  deleteCustomer,
  updateCustomerStatus,
} from '../../../services/customerService';

const DEFAULT_FILTERS = {
  search:        '',
  status:        '',
  property_type: '',
  location:      '',
  sort:          'created_at',
  order:         'DESC',
  page:          1,
  limit:         15,
};

export function useCustomers() {
  const [customers,  setCustomers]  = useState([]);
  const [meta,       setMeta]       = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [pipeline,   setPipeline]   = useState([]);
  const [filters,    setFilters]    = useState(DEFAULT_FILTERS);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  /* ── Fetch pipeline counts (for header KPIs) ─────────────── */
  const fetchPipeline = useCallback(async () => {
    try {
      const data = await getCustomerPipeline();
      setPipeline(data || []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  /* ── Fetch list whenever filters change ──────────────────── */
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      }
      const res = await getCustomers(params);
      setCustomers(res.data || []);
      setMeta(res.meta || { total: 0, page: 1, limit: 15, totalPages: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  /* ── Filter helpers ──────────────────────────────────────── */
  const setFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? value : 1 }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const setPage  = (page)    => setFilter('page', page);
  const setSort  = (sortKey) =>
    setFilters((f) => ({
      ...f,
      sort:  sortKey,
      order: f.sort === sortKey && f.order === 'DESC' ? 'ASC' : 'DESC',
      page:  1,
    }));

  /* ── Delete ──────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteCustomer(id);
      toast.success('Customer deleted');
      fetchCustomers();
      fetchPipeline();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Status change ───────────────────────────────────────── */
  const handleStatusChange = async (id, status) => {
    try {
      await updateCustomerStatus(id, status);
      toast.success('Status updated');
      fetchCustomers();
      fetchPipeline();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  /* ── Pipeline helper: total by status ───────────────────── */
  const pipelineCount = (status) => {
    const row = pipeline.find((p) => p.status === status);
    return row ? Number(row.count) : 0;
  };

  const totalCustomers = pipeline.reduce((s, p) => s + Number(p.count), 0);

  return {
    customers, meta, pipeline, filters, loading, deletingId,
    setFilter, resetFilters, setPage, setSort,
    handleDelete, handleStatusChange,
    pipelineCount, totalCustomers,
    refetch: fetchCustomers,
  };
}
