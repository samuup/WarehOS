import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, uiLogin, logout } from '../helpers/ui';
import { changePassword, invokeApi } from '../helpers/seed';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);
});

test.afterAll(async () => {
  if (handle) await handle.close();
});

test('con la contraseña por defecto se muestra el aviso de cambiarla', async () => {
  const banner = handle.win.getByText('Estás usando la contraseña por defecto');
  await expect(banner).toBeVisible({ timeout: 10_000 });
});

test('tras cambiar la contraseña el aviso desaparece en el siguiente login', async () => {
  const res = await changePassword(handle.win, {
    userId: 1,
    currentPassword: 'admin123',
    newPassword: 'nuevaClave1',
  });
  expect(res.success).toBe(true);

  const me = await invokeApi(handle.win, ['auth', 'me'], 1);
  expect((me.data as { mustChangePassword?: boolean }).mustChangePassword).toBe(false);

  await logout(handle.win);
  await uiLogin(handle.win, 'admin', 'nuevaClave1');
  await handle.win.locator('h1', { hasText: 'Dashboard' }).waitFor({ timeout: 20_000 });
  await expect(handle.win.getByText('Estás usando la contraseña por defecto')).not.toBeVisible({
    timeout: 10_000,
  });
});