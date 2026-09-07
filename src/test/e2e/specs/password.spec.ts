import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, logout, freshNav, uiLogin } from '../helpers/ui';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);
});

test('cambiar contraseña desde Configuración', async () => {
  await freshNav(handle.win, '/settings');
  const card = handle.win.locator('.card', { hasText: 'Cambiar contraseña' });
  const pws = card.locator('input[type="password"]');
  await pws.nth(0).fill('admin123');
  await pws.nth(1).fill('nueva123');
  await pws.nth(2).fill('nueva123');
  await card.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(handle.win.getByText('Contraseña actualizada correctamente')).toBeVisible();
});

test('cerrar sesión y entrar con la NUEVA contraseña funciona', async () => {
  await logout(handle.win);
  await uiLogin(handle.win, 'admin', 'nueva123');
  await expect(handle.win.locator('h1', { hasText: 'Dashboard' })).toBeVisible();
});

test('la contraseña ANTIGUA ya no funciona', async () => {
  await logout(handle.win);
  await uiLogin(handle.win, 'admin', 'admin123');
  await expect(handle.win.getByText('Credenciales inválidas')).toBeVisible();
});

test('la confirmación distinta es rechazada', async () => {
  await uiLogin(handle.win, 'admin', 'nueva123');
  await freshNav(handle.win, '/settings');
  const card = handle.win.locator('.card', { hasText: 'Cambiar contraseña' });
  const pws = card.locator('input[type="password"]');
  await pws.nth(0).fill('nueva123');
  await pws.nth(1).fill('nueva456');
  await pws.nth(2).fill('nueva789');
  await card.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(handle.win.getByText('La confirmación de la nueva contraseña no coincide')).toBeVisible();
});

test('la contraseña nueva demasiado corta es rechazada', async () => {
  await freshNav(handle.win, '/settings');
  const card = handle.win.locator('.card', { hasText: 'Cambiar contraseña' });
  const pws = card.locator('input[type="password"]');
  await pws.nth(0).fill('nueva123');
  await pws.nth(1).fill('123');
  await pws.nth(2).fill('123');
  await card.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(handle.win.getByText('La nueva contraseña debe tener al menos 6 caracteres')).toBeVisible();
});