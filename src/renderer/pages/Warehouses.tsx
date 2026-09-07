import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useWarehouseStore } from '../store/warehouseStore';
import { useAuthStore } from '../store/authStore';
import { Modal } from '../components/Modal';
import { AlertBadge } from '../components/AlertBadge';
import { formatDate } from '../lib/formatters';
import type { WarehouseInput } from '@shared/types';

export function Warehouses() {
  const { warehouses, loading, fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } =
    useWarehouseStore();
  const user = useAuthStore((s) => s.user);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setAddress('');
    setError(null);
    setShowModal(true);
  };

  const openEdit = (id: number) => {
    const wh = warehouses.find((w) => w.id === id);
    if (!wh) return;
    setEditing(id);
    setName(wh.name);
    setAddress(wh.address);
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) return;
    const input: WarehouseInput = { name, address };
    const err =
      editing === null
        ? await createWarehouse(input, user.id)
        : await updateWarehouse(editing, input, user.id);
    if (err) {
      setError(err);
    } else {
      setShowModal(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    if (!user) return;
    const wh = warehouses.find((w) => w.id === id);
    if (!wh) return;
    if (!window.confirm(`¿Eliminar el almacén "${wh.name}"?`)) return;
    const err = await deleteWarehouse(id, user.id);
    if (err) setError(err);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Almacenes</h1>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nuevo almacén
        </button>
      </div>

      {error && <AlertBadge type="error">{error}</AlertBadge>}

      <p className="text-sm text-gray-500 dark:text-slate-400">
        Aquí defines las sucursales o ubicaciones donde se guarda tu inventario. El{' '}
        <span className="font-medium">almacén principal</span> no se puede eliminar.
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Almacén</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Dirección</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Creado</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                    No hay almacenes registrados
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-slate-200">
                        {w.name}
                        {w.is_default === 1 && (
                          <span className="ml-2 px-2 py-0.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300">
                            Principal
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{w.address || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{formatDate(w.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => openEdit(w.id)}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          Editar
                        </button>
                        {w.is_default !== 1 && (
                          <button
                            onClick={() => handleDelete(w.id)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium dark:text-red-400 dark:hover:text-red-300"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editing === null ? 'Nuevo almacén' : 'Editar almacén'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <AlertBadge type="error">{error}</AlertBadge>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nombre*</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                required
                placeholder="Ej: Almacén central, Sucursal norte..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Dirección</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input-field"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Guardar
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}