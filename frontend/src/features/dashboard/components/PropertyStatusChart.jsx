import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useI18n } from '../../../i18n';

const STATUS_COLORS = {
  available:  '#16a34a',
  rented:     '#0284c7',
  sold:       '#1E40AF',
  reserved:   '#ca8a04',
  off_market: '#6b7280',
};

const RADIAN = Math.PI / 180;

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white rounded-lg shadow-dropdown border border-dark-100 px-3 py-2">
      <p className="text-sm font-semibold text-dark-800">{d.name}</p>
      <p className="text-sm text-dark-500">{d.value}</p>
    </div>
  );
}

function PropertyStatusChart({ byStatus = [], loading }) {
  const { t } = useI18n();

  if (loading) return <div className="skeleton h-64 w-full rounded-xl" />;

  const data = byStatus
    .map((row) => ({
      name:  t(`properties.status.${row.status}`) || row.status,
      value: Number(row.count),
      color: STATUS_COLORS[row.status] ?? '#9ca3af',
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-dark-400 text-sm">
        {t('common.noData')}
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
            paddingAngle={3} dataKey="value" labelLine={false} label={<CustomLabel />}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" iconSize={8}
            formatter={(v) => <span style={{ fontSize: 12, color: '#4b5563' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-2xl font-bold text-dark-800 leading-none">{total}</p>
        <p className="text-xs text-dark-400 mt-0.5">{t('common.total')}</p>
      </div>
    </div>
  );
}

export default PropertyStatusChart;
