import { create } from 'zustand';
import { api } from '@/lib/api';
import type { LicenseStatus } from '@shared/types';

interface LicenseState {
  status: LicenseStatus | null;
  loading: boolean;
  isPro: boolean;
  isTrial: boolean;
  isExpired: boolean;
  fetchStatus: () => Promise<void>;
  activate: (key: string, userId: number) => Promise<string | null>;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: null,
  loading: true,
  isPro: false,
  isTrial: false,
  isExpired: false,

  fetchStatus: async () => {
    const res = await api.license.getStatus();
    if (res.success && res.data) {
      set({
        status: res.data,
        loading: false,
        isPro: res.data.edition === 'pro',
        isTrial: res.data.edition === 'trial',
        isExpired: res.data.edition === 'trial_expired',
      });
    } else {
      set({ loading: false });
    }
  },

  activate: async (key, userId) => {
    const res = await api.license.activate(key, userId);
    if (res.success && res.data) {
      set({
        status: res.data,
        loading: false,
        isPro: res.data.edition === 'pro',
        isTrial: res.data.edition === 'trial',
        isExpired: res.data.edition === 'trial_expired',
      });
      return null;
    }
    return res.error || 'No se pudo activar la licencia';
  },
}));