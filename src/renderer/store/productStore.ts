import { create } from 'zustand';
import { api } from '@/lib/api';
import { useAuthStore } from './authStore';
import type { Category, CategoryInput, ImportResult, Product, ProductInput } from '@shared/types';

function currentUserId(): number | null {
  return useAuthStore.getState().user?.id ?? null;
}

interface ProductState {
  categories: Category[];
  products: Product[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (input: CategoryInput) => Promise<string | null>;
  updateCategory: (id: number, input: CategoryInput) => Promise<string | null>;
  deleteCategory: (id: number) => Promise<string | null>;
  fetchProducts: (params?: { search?: string; category_id?: number; warehouse_id?: number }) => Promise<void>;
  createProduct: (input: ProductInput) => Promise<string | null>;
  updateProduct: (id: number, input: ProductInput) => Promise<string | null>;
  deleteProduct: (id: number) => Promise<string | null>;
  importProducts: () => Promise<ImportResult | null>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  categories: [],
  products: [],
  loading: false,

  fetchCategories: async () => {
    const res = (await api.categories.list()) as { success: boolean; data?: Category[] };
    if (res.success && res.data) set({ categories: res.data });
  },

  createCategory: async (input) => {
    const userId = currentUserId();
    const res = (await api.categories.create(input, userId as number)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchCategories();
      return null;
    }
    return res.error || 'Error al crear categoría';
  },

  updateCategory: async (id, input) => {
    const userId = currentUserId();
    const res = (await api.categories.update(id, input, userId as number)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchCategories();
      return null;
    }
    return res.error || 'Error al actualizar categoría';
  },

  deleteCategory: async (id) => {
    const userId = currentUserId();
    const res = (await api.categories.delete(id, userId as number)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchCategories();
      return null;
    }
    return res.error || 'Error al eliminar categoría';
  },

  fetchProducts: async (params?) => {
    set({ loading: true });
    const res = (await api.products.list(params)) as { success: boolean; data?: Product[] };
    if (res.success && res.data) set({ products: res.data, loading: false });
    else set({ loading: false });
  },

  createProduct: async (input) => {
    const userId = currentUserId();
    const res = (await api.products.create(input, userId as number)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchProducts();
      return null;
    }
    return res.error || 'Error al crear producto';
  },

  updateProduct: async (id, input) => {
    const userId = currentUserId();
    const res = (await api.products.update(id, input, userId as number)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchProducts();
      return null;
    }
    return res.error || 'Error al actualizar producto';
  },

  deleteProduct: async (id) => {
    const userId = currentUserId();
    const res = (await api.products.delete(id, userId as number)) as { success: boolean; error?: string };
    if (res.success) {
      await get().fetchProducts();
      return null;
    }
    return res.error || 'Error al eliminar producto';
  },

  importProducts: async () => {
    const userId = currentUserId();
    if (userId == null) return null;
    const res = (await api.products.import(userId)) as { success: boolean; data?: ImportResult; error?: string };
    if (res.success && res.data) {
      await get().fetchProducts();
      await get().fetchCategories();
      return res.data;
    }
    return null;
  },
}));