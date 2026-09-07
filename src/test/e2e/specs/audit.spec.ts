import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, uiLogin, logout, freshNav } from '../helpers/ui';
import { invokeApi } from '../helpers/seed';

let handle: AppHandle;
let viewerId: number;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);

  await invokeApi(handle.win, ['categories', 'create'], {
    name: 'CatAudit',
    description: 'para auditoría',
  }, 1);
  const viewer = await invokeApi(handle.win, ['auth', 'register'], {
    name: 'Viewer Aud',
    username: 'vAuditoria',
    password: 'viewer123',
  }, 1);
  viewerId = (viewer.data as { id: number }).id;
});

test('la página de Auditoría lista eventos incluyendo la categoría creada', async () => {
  await freshNav(handle.win, '/audit');
  await expect(handle.win.locator('h1', { hasText: 'Auditoría' })).toBeVisible();
  await expect(handle.win.locator('tr', { hasText: 'CatAudit' })).toBeVisible({ timeout: 10_000 });
});

test('las acciones quedan registradas: categoría creada', async () => {
  const res = await invokeApi(handle.win, ['audit', 'list'], { entity: 'category', action: 'create' }, 1);
  expect(res.success).toBe(true);
  const logs = res.data as Array<{ entity: string; action: string; detail: string }>;
  expect(logs.length).toBeGreaterThan(0);
  expect(logs.some((l) => l.entity === 'category' && l.action === 'create' && l.detail === 'CatAudit')).toBe(true);
});

test('un usuario viewer no tiene acceso a la auditoría', async () => {
  await logout(handle.win);
  await uiLogin(handle.win, 'vAuditoria', 'viewer123');
  await handle.win.locator('h1', { hasText: 'Dashboard' }).waitFor({ timeout: 20_000 });

  await expect(handle.win.locator('a[href="#/audit"]')).toHaveCount(0);

  const denied = await invokeApi(handle.win, ['audit', 'list'], {}, viewerId);
  expect(denied.success).toBe(false);
  expect(String(denied.error ?? '')).toContain('permisos');
});