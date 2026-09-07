import { create } from 'zustand';
import { api } from '@/lib/api';
import type { StockMovement, StockMovementInput, DashboardSummary, InventoryReportItem } from '@shared/types';

interface InventoryState {
  movements: StockMovement[];
  dashboard: DashboardSummary | null;
  inventoryReport: InventoryReportItem[];
  loading: boolean;
  fetchMovements: (params?: { product_id?: number; type?: string; from?: string; to?: string; warehouse_id?: number }) => Promise<void>;
  createMovement: (input: StockMovementInput, userId: number) => Promise<string | null>;
  fetchDashboard: () => Promise<void>;
  fetchInventoryReport: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  movements: [],
  dashboard: null,
  inventoryReport: [],
  loading: false,

  fetchMovements: async (params?) => {
    set({ loading: true });
    const res = (await api.movements.list(params)) as { success: boolean; data?: StockMovement[] };
    if (res.success && res.data) set({ movements: res.data, loading: false });
    else set({ loading: false });
  },

  createMovement: async (input, userId) => {
    const res = (await api.movements.create(input, userId)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchMovements();
      return null;
    }
    return res.error || 'Error al registrar movimiento';
  },

  fetchDashboard: async () => {
    const res = (await api.dashboard.summary()) as { success: boolean; data?: DashboardSummary };
    if (res.success && res.data) set({ dashboard: res.data });
  },

  fetchInventoryReport: async () => {
    const res = (await api.reports.inventory()) as { success: boolean; data?: InventoryReportItem[] };
    if (res.success && res.data) set({ inventoryReport: res.data });
  },
}));