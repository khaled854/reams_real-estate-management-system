import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getAppointments,
  getAppointmentStats,
  deleteAppointment,
  updateAppointmentStatus,
} from '../../../services/appointmentService';

const DEFAULT_FILTERS = {
  search:      '',
  status:      '',
  type:        '',
  property_id: '',
  assigned_to: '',
  date_from:   '',
  date_to:     '',
  sort:        'appointment_date',
  order:       'ASC',
  page:        1,
  limit:       20,
};

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [meta,         setMeta]         = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [stats,        setStats]        = useState(null);
  const [filters,      setFilters]      = useState(DEFAULT_FILTERS);
  const [loading,      setLoading]      = useState(true);
  const [deletingId,   setDeletingId]   = useState(null);

  /* ── Fetch stats ─────────────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    try {
      const res = await getAppointmentStats();
      setStats(res.data ?? null);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── Fetch list ──────────────────────────────────────────── */
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      }
      const res = await getAppointments(params);
      setAppointments(res.data  ?? []);
      setMeta(res.meta ?? { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  /* ── Filter helpers ──────────────────────────────────────── */
  const setFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  /* ── Status update ───────────────────────────────────────── */
  const changeStatus = useCallback(async (id, status, adminNotes) => {
    try {
      await updateAppointmentStatus(id, status, adminNotes);
      toast.success(`Appointment ${status}`);
      await fetchAppointments();
      await fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
      throw err;
    }
  }, [fetchAppointments, fetchStats]);

  /* ── Delete ──────────────────────────────────────────────── */
  const remove = useCallback(async (id) => {
    setDeletingId(id);
    try {
      await deleteAppointment(id);
      toast.success('Appointment deleted');
      await fetchAppointments();
      await fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete appointment');
    } finally {
      setDeletingId(null);
    }
  }, [fetchAppointments, fetchStats]);

  /* ── Refresh ─────────────────────────────────────────────── */
  const refresh = useCallback(() => {
    fetchAppointments();
    fetchStats();
  }, [fetchAppointments, fetchStats]);

  return {
    appointments, meta, stats, filters, loading, deletingId,
    setFilter, resetFilters, changeStatus, remove, refresh,
  };
}
