import { create } from 'zustand';
import { api } from '@/lib/api';
import type { User } from '@shared/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  loadSession: () => Promise<void>;
  refreshUser: (userId: number) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (username, password) => {
    const res = (await api.auth.login({ username, password })) as {
      success: boolean;
      data?: User;
      error?: string;
    };
    if (res.success && res.data) {
      localStorage.setItem('user', JSON.stringify(res.data));
      set({ user: res.data });
      return null;
    }
    return res.error || 'Error desconocido';
  },

  logout: () => {
    localStorage.removeItem('user');
    set({ user: null });
  },

  loadSession: async () => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const user = JSON.parse(stored) as User;
        set({ user, loading: false });
      } catch {
        localStorage.removeItem('user');
        set({ loading: false });
      }
    } else {
      set({ loading: false });
    }
  },

  refreshUser: async (userId) => {
    const res = (await api.auth.me(userId)) as {
      success: boolean;
      data?: User;
    };
    if (res.success && res.data) {
      localStorage.setItem('user', JSON.stringify(res.data));
      set({ user: res.data });
    } else {
      localStorage.removeItem('user');
      set({ user: null });
    }
  },
}));