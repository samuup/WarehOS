import { create } from 'zustand';
import { api } from '@/lib/api';
import { useAuthStore } from './authStore';
import type { Company, CompanyInput } from '@shared/types';

function currentUserId(): number | null {
  return useAuthStore.getState().user?.id ?? null;
}

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'app_theme';

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readTheme(),
  resolvedTheme: 'light',

  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage errors
    }
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  toggleTheme: () => {
    const next: Theme = get().resolvedTheme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

export function initTheme() {
  const { theme, setTheme } = useThemeStore.getState();
  setTheme(theme);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    const current = useThemeStore.getState();
    if (current.theme === 'system') {
      const resolved = resolveTheme('system');
      applyTheme(resolved);
      set({ resolvedTheme: resolved });
    }
  });
}

interface SettingsState {
  company: Company | null;
  loading: boolean;
  fetchCompany: () => Promise<void>;
  updateCompany: (input: CompanyInput) => Promise<string | null>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  company: null,
  loading: false,

  fetchCompany: async () => {
    set({ loading: true });
    const res = (await api.company.get()) as { success: boolean; data?: Company };
    if (res.success && res.data) set({ company: res.data, loading: false });
    else set({ loading: false });
  },

  updateCompany: async (input) => {
    const userId = currentUserId();
    const res = (await api.company.update(input, userId as number)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchCompany();
      return null;
    }
    return res.error || 'Error al actualizar empresa';
  },
}));