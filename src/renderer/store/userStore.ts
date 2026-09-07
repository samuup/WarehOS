import { create } from 'zustand';
import { api } from '@/lib/api';
import { useAuthStore } from './authStore';
import type { User, UserInput } from '@shared/types';

interface UserState {
  users: User[];
  loading: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (input: UserInput) => Promise<string | null>;
  deleteUser: (id: number) => Promise<string | null>;
}

function currentUserId(): number | null {
  return useAuthStore.getState().user?.id ?? null;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  loading: false,

  fetchUsers: async () => {
    const userId = currentUserId();
    if (userId == null) return;
    set({ loading: true });
    const res = (await api.auth.listUsers(userId)) as { success: boolean; data?: User[]; error?: string };
    if (res.success && res.data) set({ users: res.data, loading: false });
    else set({ loading: false });
  },

  createUser: async (input) => {
    const userId = currentUserId();
    if (userId == null) return 'No autenticado';
    const res = (await api.auth.register(input, userId)) as {
      success: boolean;
      data?: User;
      error?: string;
    };
    if (res.success) {
      await get().fetchUsers();
      return null;
    }
    return res.error || 'Error al crear usuario';
  },

  deleteUser: async (id) => {
    const userId = currentUserId();
    if (userId == null) return 'No autenticado';
    const res = (await api.auth.deleteUser(id, userId)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchUsers();
      return null;
    }
    return res.error || 'Error al eliminar usuario';
  },
}));
