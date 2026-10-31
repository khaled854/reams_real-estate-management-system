import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getDashboardStats, getPropertiesReport, getCustomersReport } from '../../../services/reportService';
import { getAppointmentStats } from '../../../services/appointmentService';

/**
 * useDashboard
 * Fetches all data needed for the main dashboard in parallel.
 * Returns KPIs, property charts, customer charts, appointment stats, and a refetch trigger.
 */
export function useDashboard() {
  const [kpis,        setKpis]        = useState(null);
  const [propReport,  setPropReport]  = useState(null);
  const [custReport,  setCustReport]  = useState(null);
  const [apptStats,   setApptStats]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpiData, propData, custData, apptData] = await Promise.all([
        getDashboardStats(),
        getPropertiesReport(),
        getCustomersReport(),
        getAppointmentStats().catch(() => ({ data: null })), // non-fatal if table not yet migrated
      ]);
      setKpis(kpiData);
      setPropReport(propData);
      setCustReport(custData);
      setApptStats(apptData?.data ?? null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load dashboard data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { kpis, propReport, custReport, apptStats, loading, error, refetch: fetchAll };
}
