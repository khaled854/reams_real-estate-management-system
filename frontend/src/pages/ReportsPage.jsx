import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import PageHeader from '../components/common/PageHeader';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import Badge from '../components/common/Badge';
import { getPropertiesReport, getCustomersReport, getFinancialsReport, getAgentsReport } from '../services/reportService';
import usePermissions from '../hooks/usePermissions';
import toast from 'react-hot-toast';

/* ── Helpers ──────────────────────────────────────────────── */
function fmtCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0, notation: 'compact' }).format(n ?? 0);
}
function fmtFull(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(n ?? 0);
}

/* ── Tooltip ──────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, prefix = '', suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-dropdown border border-dark-100 px-3 py-2 text-sm">
      {label && <p className="font-semibold text-dark-700 mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }} className="font-medium">
          {p.name}: {prefix}{p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

/* ── Tab button ───────────────────────────────────────────── */
function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
        active
          ? 'bg-primary-800 text-white shadow-sm'
          : 'text-dark-600 hover:bg-dark-100'
      )}
    >
      {children}
    </button>
  );
}

/* ── Date filter ──────────────────────────────────────────── */
function DateFilter({ fromDate, toDate, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-dark-500">Period:</span>
      <input
        type="date"
        value={fromDate}
        onChange={(e) => onChange('from_date', e.target.value)}
        className="input-base py-1.5 text-sm w-36"
      />
      <span className="text-dark-400 text-sm">—</span>
      <input
        type="date"
        value={toDate}
        onChange={(e) => onChange('to_date', e.target.value)}
        className="input-base py-1.5 text-sm w-36"
      />
      {(fromDate || toDate) && (
        <button
          onClick={() => { onChange('from_date', ''); onChange('to_date', ''); }}
          className="btn-ghost btn-sm text-danger"
        >
          Clear
        </button>
      )}
    </div>
  );
}

const PROP_STATUS_COLORS  = { available: '#16a34a', rented: '#0284c7', sold: '#1E40AF', reserved: '#ca8a04', off_market: '#6b7280' };
const CUST_STATUS_COLORS  = { new: '#0284c7', contacted: '#1E40AF', interested: '#ca8a04', negotiating: '#F97316', closed: '#16a34a', lost: '#dc2626' };
const BRAND_COLORS        = ['#1E40AF','#F97316','#16a34a','#0284c7','#ca8a04','#6b7280','#2563eb','#ea580c'];

/* ══════════════════════════════════════════════════════════════
   PROPERTIES TAB
═══════════════════════════════════════════════════════════════ */
function PropertiesReport({ data, loading }) {
  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" /></div>;
  if (!data)   return null;

  const statusData = (data.byStatus ?? []).map((r) => ({
    name: r.status.charAt(0).toUpperCase() + r.status.slice(1),
    value: Number(r.count),
    color: PROP_STATUS_COLORS[r.status] ?? '#9ca3af',
  }));

  const typeData = (data.byType ?? [])
    .filter((r) => r.type)
    .map((r) => ({ name: r.type, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count);

  const monthlyData = (data.monthly ?? []).map((r) => ({
    month: r.month.slice(5),
    Added: Number(r.count),
  }));

  const total = statusData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statusData.map((s) => (
          <div key={s.name} className="bg-white rounded-xl border border-dark-100 p-4 text-center">
            <p className="text-2xl font-bold text-dark-800">{s.value}</p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <p className="text-xs text-dark-500">{s.name}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Status pie */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">Status Distribution</h3>
          </div>
          <div className="px-4 pb-5">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  paddingAngle={3} dataKey="value">
                  {statusData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ fontSize: 11, color: '#4b5563' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly added */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">Properties Added (Monthly)</h3>
          </div>
          <div className="px-4 pb-5">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyData} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1E40AF" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Added" stroke="#1E40AF" strokeWidth={2} fill="url(#ga)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* By type bar */}
      <Card padding={false}>
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-dark-800">Properties by Type</h3>
        </div>
        <div className="px-4 pb-5">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData} margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {typeData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CUSTOMERS TAB
═══════════════════════════════════════════════════════════════ */
function CustomersReport({ data, loading }) {
  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" /></div>;
  if (!data)   return null;

  const statusData = (data.byStatus ?? []).map((r) => ({
    name: r.status.charAt(0).toUpperCase() + r.status.slice(1),
    value: Number(r.count),
    color: CUST_STATUS_COLORS[r.status] ?? '#9ca3af',
  }));

  const empData = (data.byEmployee ?? [])
    .filter((r) => r.employee)
    .map((r) => ({ name: r.employee, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const monthlyData = (data.monthly ?? []).map((r) => ({
    month: r.month.slice(5),
    Added: Number(r.count),
  }));

  return (
    <div className="space-y-6">
      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statusData.map((s) => (
          <div key={s.name} className="bg-white rounded-xl border border-dark-100 p-4 text-center">
            <p className="text-2xl font-bold text-dark-800">{s.value}</p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <p className="text-xs text-dark-500">{s.name}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Status pie */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">Pipeline Distribution</h3>
          </div>
          <div className="px-4 pb-5">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} paddingAngle={3} dataKey="value">
                  {statusData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ fontSize: 11, color: '#4b5563' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly trend */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">Customers Added (Monthly)</h3>
          </div>
          <div className="px-4 pb-5">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyData} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Added" stroke="#F97316" strokeWidth={2} fill="url(#gb)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* By employee */}
      {empData.length > 0 && (
        <Card padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">Customers by Employee</h3>
          </div>
          <div className="px-4 pb-5">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={empData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#1E40AF" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FINANCIALS TAB (admin only)
═══════════════════════════════════════════════════════════════ */
function FinancialsReport({ data, loading }) {
  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" /></div>;
  if (!data)   return null;

  const { byType = [], monthly = [], totals = {} } = data;

  const monthlyData = monthly.map((r) => ({
    month:   r.month.slice(5),
    Revenue: Number(r.revenue),
  }));

  // Summarise by type for the bar chart
  const typeData = byType
    .filter((r) => r.type)
    .reduce((acc, r) => {
      const existing = acc.find((a) => a.type === r.type);
      if (existing) {
        existing.total += Number(r.total);
      } else {
        acc.push({ type: r.type.charAt(0).toUpperCase() + r.type.slice(1), total: Number(r.total) });
      }
      return acc;
    }, []);

  return (
    <div className="space-y-6">

      {/* KPI totals row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Paid',    value: totals.total_paid,    color: 'border-success' },
          { label: 'Total Pending', value: totals.total_pending, color: 'border-warning' },
          { label: 'Total Overdue', value: totals.total_overdue, color: 'border-danger' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-white rounded-xl border-l-4 ${color} px-5 py-4 shadow-xs`}>
            <p className="text-xs text-dark-500 font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-dark-800">{fmtFull(value)}</p>
          </div>
        ))}
      </div>

      {/* Monthly revenue trend */}
      <Card padding={false}>
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-dark-800">Monthly Revenue (Paid)</h3>
          <p className="text-xs text-dark-400 mt-0.5">Last 12 months — paid transactions only</p>
        </div>
        <div className="px-4 pb-5">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyData} margin={{ left: 8, right: 8 }}>
              <defs>
                <linearGradient id="gfin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={70}
                tickFormatter={(v) => fmtCurrency(v)} />
              <Tooltip content={<ChartTooltip />} formatter={(v) => fmtFull(v)} />
              <Area type="monotone" dataKey="Revenue" stroke="#16a34a" strokeWidth={2} fill="url(#gfin)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* By type bar chart */}
      {typeData.length > 0 && (
        <Card padding={false}>
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-dark-800">Amount by Transaction Type</h3>
          </div>
          <div className="px-4 pb-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={70}
                  tickFormatter={(v) => fmtCurrency(v)} />
                <Tooltip content={<ChartTooltip />} formatter={(v) => fmtFull(v)} />
                <Bar dataKey="total" fill="#1E40AF" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {typeData.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Detail table */}
      {byType.length > 0 && (
        <div className="table-wrapper bg-white">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th className="text-center">Count</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {byType.map((row, i) => (
                <tr key={i} className="border-b border-dark-50 hover:bg-primary-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-dark-700 capitalize">{row.type}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={row.status === 'paid' ? 'success' : row.status === 'overdue' ? 'danger' : 'warning'}
                      size="sm"
                    >
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-dark-600">{row.count}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-primary-800">{fmtFull(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AGENTS TAB (admin only)
═══════════════════════════════════════════════════════════════ */
function AgentsReport({ data, loading }) {
  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" /></div>;
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg className="w-12 h-12 text-dark-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p className="text-dark-500 font-medium">No agent data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="table-wrapper bg-white">
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              <th className="text-center">Properties</th>
              <th className="text-center">Available</th>
              <th className="text-center">Sold</th>
              <th className="text-center">Rented</th>
              <th className="text-center">Contracts</th>
              <th className="text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((agent, i) => (
              <tr key={agent.id ?? i} className="border-b border-dark-50 hover:bg-primary-50/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                      {agent.agent_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-dark-800">{agent.agent_name}</p>
                      {i === 0 && <span className="text-2xs text-secondary-500 font-semibold">Top Performer</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-sm font-semibold text-dark-700">{agent.total_properties}</td>
                <td className="px-4 py-3 text-center"><Badge variant="success" size="sm">{agent.available}</Badge></td>
                <td className="px-4 py-3 text-center"><Badge variant="primary" size="sm">{agent.sold}</Badge></td>
                <td className="px-4 py-3 text-center"><Badge variant="info" size="sm">{agent.rented}</Badge></td>
                <td className="px-4 py-3 text-center text-sm text-dark-600">{agent.completed_contracts}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-primary-800">{fmtCurrency(agent.total_revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Revenue bar chart */}
      <Card padding={false}>
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-dark-800">Revenue by Agent</h3>
        </div>
        <div className="px-4 pb-5">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.map((a) => ({ name: a.agent_name, revenue: Number(a.total_revenue) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50}
                tickFormatter={(v) => fmtCurrency(v)} />
              <Tooltip content={<ChartTooltip prefix="SAR " />} />
              <Bar dataKey="revenue" fill="#1E40AF" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN REPORTS PAGE
═══════════════════════════════════════════════════════════════ */
function ReportsPage() {
  const { isAdmin, can } = usePermissions();
  const [activeTab, setActiveTab] = useState('properties');
  const [fromDate,  setFromDate]  = useState('');
  const [toDate,    setToDate]    = useState('');

  const [propData,   setPropData]   = useState(null);
  const [custData,   setCustData]   = useState(null);
  const [agentData,  setAgentData]  = useState(null);
  const [finData,    setFinData]    = useState(null);
  const [loading,    setLoading]    = useState(false);

  const handleDateChange = (key, val) => {
    if (key === 'from_date') setFromDate(val);
    if (key === 'to_date')   setToDate(val);
  };

  const params = { from_date: fromDate || undefined, to_date: toDate || undefined };

  const loadTab = useCallback(async (tab) => {
    setLoading(true);
    try {
      if (tab === 'properties') {
        const d = await getPropertiesReport(params);
        setPropData(d);
      } else if (tab === 'customers') {
        const d = await getCustomersReport(params);
        setCustData(d);
      } else if (tab === 'agents' && isAdmin) {
        const d = await getAgentsReport(params);
        setAgentData(d);
      } else if (tab === 'financials' && isAdmin) {
        const d = await getFinancialsReport(params);
        setFinData(d);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]); // eslint-disable-line

  useEffect(() => { loadTab(activeTab); }, [activeTab, fromDate, toDate]); // eslint-disable-line

  const TABS = [
    { id: 'properties', label: 'Properties' },
    { id: 'customers',  label: 'Customers' },
    ...(isAdmin ? [
      { id: 'financials', label: 'Financials' },
      { id: 'agents',     label: 'Agent Performance' },
    ] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Analytics and performance overview"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}
      />

      <Card className="mb-5" padding={false}>
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-dark-100">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <Tab key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </Tab>
            ))}
          </div>
          {/* Date filter */}
          <DateFilter fromDate={fromDate} toDate={toDate} onChange={handleDateChange} />
        </div>
      </Card>

      {/* Tab content */}
      {activeTab === 'properties' && <PropertiesReport data={propData}  loading={loading} />}
      {activeTab === 'customers'  && <CustomersReport  data={custData}  loading={loading} />}
      {activeTab === 'financials' && <FinancialsReport data={finData}   loading={loading} />}
      {activeTab === 'agents'     && <AgentsReport     data={agentData} loading={loading} />}
    </div>
  );
}

export default ReportsPage;
