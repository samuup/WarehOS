import type { Page } from 'playwright';

export interface ApiResultLike {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Invoca un canal de la API real del renderer (window.api -> preload ->
 * IPC main). Permite sembrar datos y probar el backend sin pasar por la UI.
 */
export async function invokeApi(win: Page, path: string[], ...args: unknown[]): Promise<ApiResultLike> {
  return win.evaluate(
    ([channel, callArgs]) => {
      let node: unknown = (window as unknown as { api: Record<string, unknown> }).api;
      for (const key of channel) {
        node = (node as Record<string, unknown>)[key];
      }
      return (node as (...a: unknown[]) => unknown)(...callArgs);
    },
    [path, args],
  );
}

export const ADMIN_ID = 1;
export const DEFAULT_WAREHOUSE_ID = 1;

export const seedCompany = (win: Page, input: Record<string, unknown>) =>
  invokeApi(win, ['company', 'update'], input, ADMIN_ID);

export const seedCategory = (win: Page, name: string, description = '') =>
  invokeApi(win, ['categories', 'create'], { name, description }, ADMIN_ID);

export const seedProduct = (win: Page, input: Record<string, unknown>) =>
  invokeApi(win, ['products', 'create'], input, ADMIN_ID);

export const seedMovement = (win: Page, input: Record<string, unknown>) =>
  invokeApi(win, ['movements', 'create'], { note: 'E2E seed', ...input }, ADMIN_ID);

export const seedUser = (win: Page, input: Record<string, unknown>) =>
  invokeApi(win, ['auth', 'register'], input, ADMIN_ID);

export const listCategories = (win: Page) => invokeApi(win, ['categories', 'list']);

export const listProducts = (win: Page) => invokeApi(win, ['products', 'list']);

export const listMovements = (win: Page) => invokeApi(win, ['movements', 'list']);

export const listUsers = (win: Page) => invokeApi(win, ['auth', 'listUsers'], ADMIN_ID);

export const listWarehouses = (win: Page) => invokeApi(win, ['warehouses', 'list']);

export const dashboardSummary = (win: Page) => invokeApi(win, ['dashboard', 'summary']);

export const inventoryReport = (win: Page) => invokeApi(win, ['reports', 'inventory']);

export const changePassword = (win: Page, input: unknown) =>
  invokeApi(win, ['auth', 'changePassword'], input);

export const setSecurityQuestion = (win: Page, input: unknown) =>
  invokeApi(win, ['auth', 'setSecurityQuestion'], input);