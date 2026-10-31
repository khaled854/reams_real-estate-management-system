import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getProperties,
  getPropertyTypes,
  deleteProperty,
  updatePropertyStatus,
} from '../../../services/propertyService';

/**
 * useProperties
 * Manages the property list state:
 *   - Pagination
 *   - Filters (search, status, type, listing_type, price range)
 *   - Sorting
 *   - Refetch trigger
 */
const DEFAULT_FILTERS = {
  search:       '',
  status:       '',
  listing_type: '',
  type_id:      '',
  min_price:    '',
  max_price:    '',
  sort:         'created_at',
  order:        'DESC',
  page:         1,
  limit:        12,
};

export function useProperties() {
  const [properties, setProperties] = useState([]);
  const [meta,       setMeta]       = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [filters,    setFilters]    = useState(DEFAULT_FILTERS);
  const [types,      setTypes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  /* ── Fetch types once ────────────────────────────────────── */
  useEffect(() => {
    getPropertyTypes()
      .then(setTypes)
      .catch(() => {}); // types failure is non-critical
  }, []);

  /* ── Fetch list whenever filters change ──────────────────── */
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      // Strip empty filter values before sending
      const params = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      }
      const res = await getProperties(params);
      setProperties(res.data || []);
      setMeta(res.meta || { total: 0, page: 1, limit: 12, totalPages: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  /* ── Filter helpers ──────────────────────────────────────── */
  const setFilter  = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? value : 1 }));

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const setPage = (page) => setFilter('page', page);
  const setSort = (sortKey) =>
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
      await deleteProperty(id);
      toast.success('Property deleted successfully');
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete property');
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Status change ───────────────────────────────────────── */
  const handleStatusChange = async (id, status) => {
    try {
      await updatePropertyStatus(id, status);
      toast.success('Status updated');
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  return {
    properties, meta, filters, types, loading, deletingId,
    setFilter, resetFilters, setPage, setSort,
    handleDelete, handleStatusChange,
    refetch: fetchProperties,
  };
}
