import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Warehouse, WarehouseInput } from '@shared/types';

interface WarehouseState {
  warehouses: Warehouse[];
  loading: boolean;
  fetchWarehouses: () => Promise<void>;
  createWarehouse: (input: WarehouseInput, userId: number) => Promise<string | null>;
  updateWarehouse: (id: number, input: WarehouseInput, userId: number) => Promise<string | null>;
  deleteWarehouse: (id: number, userId: number) => Promise<string | null>;
}

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  warehouses: [],
  loading: false,

  fetchWarehouses: async () => {
    set({ loading: true });
    const res = await api.warehouses.list();
    if (res.success && res.data) set({ warehouses: res.data, loading: false });
    else set({ loading: false });
  },

  createWarehouse: async (input, userId) => {
    const res = await api.warehouses.create(input, userId);
    if (res.success) {
      await get().fetchWarehouses();
      return null;
    }
    return res.error || 'Error al crear el almacén';
  },

  updateWarehouse: async (id, input, userId) => {
    const res = await api.warehouses.update(id, input, userId);
    if (res.success) {
      await get().fetchWarehouses();
      return null;
    }
    return res.error || 'Error al actualizar el almacén';
  },

  deleteWarehouse: async (id, userId) => {
    const res = await api.warehouses.delete(id, userId);
    if (res.success) {
      await get().fetchWarehouses();
      return null;
    }
    return res.error || 'Error al eliminar el almacén';
  },
}));