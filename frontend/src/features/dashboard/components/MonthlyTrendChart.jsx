import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useI18n } from '../../../i18n';

function buildMerged(propMonthly = [], custMonthly = [], propLabel, custLabel) {
  const months = new Set([
    ...propMonthly.map((r) => r.month),
    ...custMonthly.map((r) => r.month),
  ]);
  const propMap = Object.fromEntries(propMonthly.map((r) => [r.month, Number(r.count)]));
  const custMap = Object.fromEntries(custMonthly.map((r) => [r.month, Number(r.count)]));
  return [...months].sort().map((month) => ({
    month: month.slice(5),
    [propLabel]: propMap[month] ?? 0,
    [custLabel]: custMap[month] ?? 0,
  }));
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-dropdown border border-dark-100 px-3 py-2.5">
      <p className="text-xs font-semibold text-dark-500 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function MonthlyTrendChart({ propMonthly, custMonthly, loading }) {
  if (loading) {
    return <div className="skeleton h-72 w-full rounded-xl" />;
  }

  const data = buildMerged(propMonthly, custMonthly);

  if (data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-dark-400 text-sm">
        No trend data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={272}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="gradProp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1E40AF" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradCust" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#F97316" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ fontSize: 12, color: '#4b5563' }}>{v}</span>}
        />
        <Area
          type="monotone"
          dataKey="Properties"
          stroke="#1E40AF"
          strokeWidth={2}
          fill="url(#gradProp)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="Customers"
          stroke="#F97316"
          strokeWidth={2}
          fill="url(#gradCust)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default MonthlyTrendChart;
