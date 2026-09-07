import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, freshNav, modal } from '../helpers/ui';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);
});

test('crear un almacén desde la página', async () => {
  await freshNav(handle.win, '/warehouses');
  await handle.win.getByRole('button', { name: 'Nuevo almacén' }).click();
  const m = modal(handle.win);
  await expect(m.locator('h2', { hasText: 'Nuevo almacén' })).toBeVisible();

  const texts = m.locator('input[type="text"]');
  await texts.nth(0).fill('Sucursal Norte');
  await texts.nth(1).fill('Av. Los Pinos 123');
  await m.getByRole('button', { name: 'Guardar' }).click();
  await expect(m).toBeHidden({ timeout: 5_000 });

  const row = handle.win.locator('tr', { hasText: 'Sucursal Norte' });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText('Av. Los Pinos 123')).toBeVisible();
});

test('editar un almacén', async () => {
  await freshNav(handle.win, '/warehouses');
  const row = handle.win.locator('tr', { hasText: 'Sucursal Norte' });
  await row.getByRole('button', { name: 'Editar' }).click();
  const m = modal(handle.win);
  await expect(m.locator('h2', { hasText: 'Editar almacén' })).toBeVisible();

  const address = m.locator('input[type="text"]').nth(1);
  await address.fill('Av. Los Pinos 999');
  await m.getByRole('button', { name: 'Guardar' }).click();
  await expect(m).toBeHidden({ timeout: 5_000 });

  await expect(handle.win.locator('tr', { hasText: 'Av. Los Pinos 999' })).toBeVisible({ timeout: 10_000 });
});

test('el almacén principal no ofrece eliminar', async () => {
  await freshNav(handle.win, '/warehouses');
  const principal = handle.win.locator('tr', { hasText: 'Almacén Principal' });
  await expect(principal).toBeVisible();
  await expect(principal.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
});

test('eliminar un almacén (con confirmación)', async () => {
  await freshNav(handle.win, '/warehouses');
  await handle.win.evaluate(() => {
    window.confirm = () => true;
  });
  const row = handle.win.locator('tr', { hasText: 'Sucursal Norte' });
  await row.getByRole('button', { name: 'Eliminar' }).click();
  await expect(row).toHaveCount(0, { timeout: 10_000 });
});