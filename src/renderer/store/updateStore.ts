import { create } from 'zustand';
import { api } from '@/lib/api';
import type { UpdaterStatus, UpdaterEvent, UpdateConfigInput } from '@shared/types';

let subscribed = false;

interface UpdateState {
  status: UpdaterStatus | null;
  fetchStatus: () => Promise<void>;
  check: (userId: number) => Promise<string | null>;
  install: (userId: number) => Promise<string | null>;
  setConfig: (input: UpdateConfigInput, userId: number) => Promise<string | null>;
  subscribe: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: null,

  fetchStatus: async () => {
    const res = await api.updates.getStatus();
    if (res.success && res.data) set({ status: res.data });
  },

  check: async (userId) => {
    const res = await api.updates.check(userId);
    return res.success ? null : res.error || 'No se pudo comprobar actualizaciones';
  },

  install: async (userId) => {
    const res = await api.updates.install(userId);
    return res.success ? null : res.error || 'No se pudo instalar la actualización';
  },

  setConfig: async (input, userId) => {
    const res = await api.updates.setConfig(input, userId);
    if (res.success && res.data) {
      set({ status: res.data });
      return null;
    }
    return res.error || 'No se pudo guardar la configuración';
  },

  subscribe: () => {
    if (subscribed) return;
    subscribed = true;
    api.updates.onEvent((event: UpdaterEvent) => {
      if (event.type === 'state' && event.status) {
        set({ status: event.status });
      }
    });
    void api.updates.getStatus().then((res) => {
      if (res.success && res.data) set({ status: res.data });
    });
  },
}));