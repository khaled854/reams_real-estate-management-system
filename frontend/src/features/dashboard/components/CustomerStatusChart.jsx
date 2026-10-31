import { RadialBarChart, RadialBar, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '../../../i18n';

const STATUS_COLORS = {
  new:         '#0284c7',
  contacted:   '#1E40AF',
  interested:  '#ca8a04',
  negotiating: '#F97316',
  closed:      '#16a34a',
  lost:        '#dc2626',
};
const STATUS_ORDER = ['new','contacted','interested','negotiating','closed','lost'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white rounded-lg shadow-dropdown border border-dark-100 px-3 py-2">
      <p className="text-sm font-semibold text-dark-800">{d.name}</p>
      <p className="text-sm text-dark-500">{d.count}</p>
    </div>
  );
}

function CustomerStatusChart({ byStatus = [], loading }) {
  const { t } = useI18n();

  if (loading) return <div className="skeleton h-64 w-full rounded-xl" />;

  const data = STATUS_ORDER
    .map((status) => {
      const row = byStatus.find((r) => r.status === status);
      return {
        name:  t(`customers.status.${status}`),
        count: row ? Number(row.count) : 0,
        fill:  STATUS_COLORS[status],
      };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-dark-400 text-sm">
        {t('common.noData')}
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const dataWithPct = data.map((d) => ({ ...d, value: Math.round((d.count / total) * 100) }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <RadialBarChart innerRadius="25%" outerRadius="90%" data={dataWithPct} startAngle={90} endAngle={-270}>
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#f3f4f6' }} />
          <Tooltip content={<CustomTooltip />} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 px-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
              <span className="text-dark-600 truncate">{d.name}</span>
            </div>
            <span className="font-semibold text-dark-800 ms-2">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CustomerStatusChart;
