import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

/**
 * PropertyTypeChart
 * Horizontal bar chart showing property count by type.
 */

const BRAND_COLORS = [
  '#1E40AF', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
  '#F97316', '#fb923c', '#fdba74', '#16a34a', '#0284c7',
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-dropdown border border-dark-100 px-3 py-2">
      <p className="text-sm font-semibold text-dark-800">{label}</p>
      <p className="text-sm text-dark-500">{payload[0].value} properties</p>
    </div>
  );
}

function PropertyTypeChart({ byType = [], loading }) {
  if (loading) {
    return <div className="skeleton h-64 w-full rounded-xl" />;
  }

  const data = byType
    .filter((r) => r.type && Number(r.count) > 0)
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 8)
    .map((r) => ({ name: r.type, count: Number(r.count) }));

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-dark-400 text-sm">
        No type data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: '#374151' }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default PropertyTypeChart;
