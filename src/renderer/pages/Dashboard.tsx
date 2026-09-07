import { useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Package,
  Wallet,
  AlertTriangle,
  TrendingUp,
  Trophy,
  PieChart as PieChartIcon,
  Timer,
  Activity,
} from 'lucide-react';
import { useInventoryStore } from '../store/inventoryStore';
import { useSettingsStore } from '../store/settingsStore';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDate, formatExpiry, MOVEMENT_LABELS, MOVEMENT_COLORS } from '../lib/formatters';
import { labelDate } from '@shared/chartLogic';
import { useI18n } from '../lib/i18n';
import { FirstStepsChecklist } from '../components/FirstStepsChecklist';

const CATEGORY_COLORS = [
  '#4f46e5',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#64748b',
];

function sectionTitle(icon: React.ReactNode, text: string) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-primary-600 dark:text-primary-400">{icon}</span>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">{text}</h2>
    </div>
  );
}

export function Dashboard() {
  const { t } = useI18n();
  const dashboard = useInventoryStore((s) => s.dashboard);
  const fetchDashboard = useInventoryStore((s) => s.fetchDashboard);
  const { company, fetchCompany } = useSettingsStore();

  useEffect(() => {
    fetchDashboard();
    fetchCompany();
  }, [fetchDashboard, fetchCompany]);

  const currency = company?.currency || 'PEN';

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{t('dashboard.title')}</h1>

      <FirstStepsChecklist summary={dashboard} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Productos registrados"
          value={String(dashboard.total_products)}
          icon={Package}
          color="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />
        <StatCard
          title="Valor total del inventario"
          value={formatCurrency(dashboard.total_stock_value, currency)}
          icon={Wallet}
          color="bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400"
        />
        <StatCard
          title="Productos con stock bajo"
          value={String(dashboard.low_stock_count)}
          icon={AlertTriangle}
          color="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          {sectionTitle(<TrendingUp className="w-5 h-5" aria-hidden="true" />, 'Tendencia de stock (30 días)')}
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dashboard.stock_trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => labelDate(d)}
                tick={{ fontSize: 11 }}
                minTickGap={20}
              />
              <YAxis tick={{ fontSize: 11 }} width={45} allowDecimals={false} />
              <Tooltip labelFormatter={(label: string) => labelDate(String(label))} />
              <Area
                type="monotone"
                dataKey="total"
                name="Unidades"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#trendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          {sectionTitle(<Trophy className="w-5 h-5" aria-hidden="true" />, 'Top productos (salidas · 30 días)')}
          {dashboard.top_moved.length === 0 ? (
            <p className="text-gray-400 text-sm py-10 text-center dark:text-slate-500">
              No hay salidas registradas en los últimos 30 días
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={dashboard.top_moved}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number | string) => [`${value} uds`, 'Cantidad']} />
                <Bar dataKey="quantity" name="Cantidad" fill="#10b981" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        {sectionTitle(<PieChartIcon className="w-5 h-5" aria-hidden="true" />, 'Distribución de stock por categoría')}
        {dashboard.stock_by_category.length === 0 ? (
          <p className="text-gray-400 text-sm py-10 text-center dark:text-slate-500">
            No hay stock que distribuir
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={dashboard.stock_by_category}
                dataKey="total"
                nameKey="category_name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                label={(entry: { category_name?: string }) => entry.category_name ?? ''}
                labelLine={false}
              >
                {dashboard.stock_by_category.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number | string) => [`${value} uds`, 'Stock']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {dashboard.low_stock_products.length > 0 && (
        <div className="card border-red-200 dark:border-red-800">
          {sectionTitle(
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" />,
            'Productos con stock bajo',
          )}
          <div className="space-y-2">
            {dashboard.low_stock_products.map((p) => (
              <div
                key={p.id}
                className="flex justify-between items-center bg-red-50 rounded-lg px-4 py-2 dark:bg-red-950/30 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <div>
                  <p className="font-medium text-gray-800 dark:text-slate-200">{p.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">SKU: {p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    {p.current_stock} {p.unit}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Mínimo: {p.stock_min}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard.expiring_lots.length > 0 && (
        <div className="card border-amber-200 dark:border-amber-800">
          {sectionTitle(
            <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
            'Lotes por vencer',
          )}
          <div className="space-y-2">
            {dashboard.expiring_lots.map((l) => (
              <div
                key={`${l.id}-${l.batch}`}
                className="flex justify-between items-center rounded-lg px-4 py-2 bg-amber-50 dark:bg-amber-950/30 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate dark:text-slate-200">{l.product_name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Lote {l.batch} · {l.warehouse_name}
                    {l.sku ? ` · SKU: ${l.sku}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold dark:text-slate-200">
                    {l.quantity} {l.unit}
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      l.status === 'expired' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {l.status === 'expired' ? 'VENCIDO' : `Vence ${formatExpiry(l.expiry_date)} (${l.days_left} d)`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        {sectionTitle(<Activity className="w-5 h-5" aria-hidden="true" />, 'Movimientos recientes')}
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {dashboard.recent_movements.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 dark:text-slate-500">No hay movimientos registrados</p>
          ) : (
            dashboard.recent_movements.map((m) => (
              <div key={m.id} className="flex justify-between items-center py-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${MOVEMENT_COLORS[m.type]}`}>
                    {MOVEMENT_LABELS[m.type]}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-slate-200">{m.product_name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{formatDate(m.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800 dark:text-slate-200">
                    {m.type === 'IN' ? '+' : m.type === 'OUT' || m.type === 'TRANSFER' ? '-' : '='} {m.quantity}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Stock: {m.new_stock}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}