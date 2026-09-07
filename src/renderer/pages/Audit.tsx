import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { formatDate } from '../lib/formatters';
import type { AuditLog, AuditLogQuery } from '@shared/types';

const ACTION_LABELS: Record<string, string> = {
  login: 'Inicio de sesión',
  register: 'Registro de usuario',
  delete_user: 'Eliminación de usuario',
  change_password: 'Cambio de contraseña',
  set_security_question: 'Pregunta de seguridad',
  reset_password: 'Recuperación de contraseña',
  create: 'Creación',
  update: 'Edición',
  delete: 'Eliminación',
  import: 'Importación',
  export: 'Exportación',
  activate: 'Activación de licencia',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'Usuario',
  category: 'Categoría',
  product: 'Producto',
  warehouse: 'Almacén',
  movement: 'Movimiento',
  settings: 'Configuración',
  company: 'Empresa',
  backup: 'Respaldo',
  license: 'Licencia',
};

const ACTION_COLORS: Record<string, string> = {
  login: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40',
  register: 'text-indigo-600 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/40',
  delete_user: 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/40',
  change_password: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40',
  set_security_question: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40',
  reset_password: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40',
  create: 'text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-950/40',
  update: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40',
  delete: 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/40',
  import: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/40',
  export: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/40',
  activate: 'text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-950/40',
};

export function Audit() {
  const user = useAuthStore((s) => s.user);
  const [filters, setFilters] = useState({ action: '', entity: '', from: '', to: '' });
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const q: AuditLogQuery = {};
    if (filters.action) q.action = filters.action;
    if (filters.entity) q.entity = filters.entity;
    if (filters.from) q.from = filters.from;
    if (filters.to) q.to = filters.to;
    const res = await api.audit.list(q, user.id);
    if (res.success && res.data) setLogs(res.data);
    setLoading(false);
  }, [user, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns = [
    {
      key: 'created_at',
      header: 'Fecha',
      render: (l: AuditLog) => formatDate(l.created_at),
      className: 'whitespace-nowrap',
    },
    {
      key: 'user',
      header: 'Usuario',
      render: (l: AuditLog) => (
        <div>
          <p className="font-medium text-gray-800 dark:text-slate-200">{l.user_name || 'Sistema'}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (l: AuditLog) => (
        <span
          className={`px-2 py-1 rounded-lg text-xs font-medium ${
            ACTION_COLORS[l.action] ?? 'text-gray-600 bg-gray-100 dark:text-slate-300 dark:bg-slate-700'
          }`}
        >
          {ACTION_LABELS[l.action] ?? l.action}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Entidad',
      render: (l: AuditLog) => (
        <span className="text-sm text-gray-600 dark:text-slate-300">{ENTITY_LABELS[l.entity] ?? l.entity}</span>
      ),
    },
    { key: 'detail', header: 'Detalle', render: (l: AuditLog) => <span className="text-sm text-gray-600 dark:text-slate-300">{l.detail}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Auditoría</h1>
        <button onClick={() => fetchLogs()} className="btn-primary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Refrescar
        </button>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Acción</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              className="input-field"
            >
              <option value="">Todas</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Entidad</label>
            <select
              value={filters.entity}
              onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value }))}
              className="input-field"
            >
              <option value="">Todas</option>
              {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Desde</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Hasta</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={logs}
            emptyMessage="No hay eventos registrados"
          />
        )}
      </div>
    </div>
  );
}