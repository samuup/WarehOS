import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { AlertBadge } from '../components/AlertBadge';
import { formatDate } from '../lib/formatters';
import { can } from '@shared/permissions';
import type { Role, User } from '@shared/types';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  operator: 'Operador',
  viewer: 'Visor',
};

const ROLE_COLORS: Record<Role, string> = {
  admin: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/40',
  operator: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40',
  viewer: 'text-gray-600 bg-gray-100 dark:text-slate-300 dark:bg-slate-700',
};

export function Users() {
  const { users, loading, fetchUsers, createUser, deleteUser } = useUserStore();
  const currentUser = useAuthStore((s) => s.user);
  const canManage = can(currentUser?.role, 'users.manage');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '', role: 'operator' as Role });
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (canManage) fetchUsers();
  }, [canManage, fetchUsers]);

  if (!canManage || !currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    const err = await createUser({
      name: form.name,
      username: form.username,
      password: form.password,
      role: form.role,
    });
    if (err) {
      setError(err);
    } else {
      setShowCreate(false);
      setForm({ name: '', username: '', password: '', confirm: '', role: 'operator' });
    }
  };

  const isProtected = (u: User) => u.role === 'admin' || u.id === currentUser.id;

  const handleDelete = async (u: User) => {
    setDeleteError(null);
    if (isProtected(u)) {
      setDeleteError('No se puede eliminar un administrador ni tu propia cuenta');
      return;
    }
    const confirmed = window.confirm(`¿Eliminar al usuario ${u.name} (@${u.username})?`);
    if (!confirmed) return;
    const err = await deleteUser(u.id);
    if (err) setDeleteError(err);
  };

  const columns: Column<User>[] = [
    { key: 'name', header: 'Nombre', render: (u) => <span className="font-medium text-gray-800 dark:text-slate-200">{u.name}</span> },
    { key: 'username', header: 'Usuario', render: (u) => <span className="text-gray-600 dark:text-slate-300">@{u.username}</span> },
    {
      key: 'role',
      header: 'Rol',
      render: (u) => (
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${ROLE_COLORS[u.role]}`}>
          {ROLE_LABELS[u.role]}
        </span>
      ),
    },
    { key: 'created_at', header: 'Creado', render: (u) => formatDate(u.created_at) },
    {
      key: 'actions',
      header: 'Acciones',
      render: (u) =>
        isProtected(u) ? (
          <span className="text-xs text-gray-300 dark:text-slate-600">{u.id === currentUser.id ? 'Tú' : '—'}</span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(u);
            }}
            className="text-sm text-red-600 hover:text-red-700 font-medium dark:text-red-400 dark:hover:text-red-300"
          >
            Eliminar
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Usuarios</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nuevo usuario
        </button>
      </div>

      {deleteError && <AlertBadge type="error">{deleteError}</AlertBadge>}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          searchable
          searchKeys={['name', 'username']}
          emptyMessage="No hay usuarios registrados"
        />
      )}

      {showCreate && (
        <Modal title="Nuevo usuario" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <AlertBadge type="error">{error}</AlertBadge>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nombre completo*</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Usuario*</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="input-field"
                autoComplete="username"
                placeholder="Entre 3 y 30 caracteres (letras, números, . _ -)"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Contraseña*</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Confirmar*</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Rol*</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="input-field"
              >
                <option value="operator">Operador</option>
                <option value="viewer">Visor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full">
              Crear usuario
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}