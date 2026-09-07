import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, freshNav } from '../helpers/ui';
import { invokeApi, seedCategory, seedProduct } from '../helpers/seed';
import { downloadDir } from '../helpers/fixtures';

let handle: AppHandle;

const PASSWORD = 'ClaveE2E123';

test.beforeAll(async () => {
  handle = await launchApp();
  const cat = await seedCategory(handle.win, 'BackCat');
  const categoryId = (cat.data as { id: number }).id;
  await seedProduct(handle.win, {
    name: 'Pendrive BK',
    sku: 'PD-BK1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 15,
    sale_price: 30,
  });
  await loginAdmin(handle.win);
});

test('exportar un backup cifrado con contraseña', async () => {
  await freshNav(handle.win, '/settings');
  const dir = downloadDir();
  const backupPath = `${dir}\\backup_e2e_${Date.now()}.db`;

  const exported = await invokeApi(handle.win, ['backup', 'export'], backupPath, PASSWORD, 1);
  expect(exported.success).toBe(true);
  expect(fs.existsSync(backupPath)).toBe(true);
  const buf = fs.readFileSync(backupPath);
  expect(buf.toString('ascii', 0, 7)).toBe('WHBAK01');
  expect(buf.toString('utf8', 0, 16)).not.toContain('SQLite format 3');
});

test('exportar con contraseña muy corta se rechaza', async () => {
  const dir = downloadDir();
  const backupPath = `${dir}\\backup_short_${Date.now()}.db`;
  const exported = await invokeApi(handle.win, ['backup', 'export'], backupPath, 'corta', 1);
  expect(exported.success).toBe(false);
  expect(fs.existsSync(backupPath)).toBe(false);
});

test('restaurar backup con la contraseña correcta', async () => {
  const dir = downloadDir();
  const backupPath = `${dir}\\backup_e2e_${Date.now()}.db`;
  expect(
    (await invokeApi(handle.win, ['backup', 'export'], backupPath, PASSWORD, 1)).success,
  ).toBe(true);

  const imported = await invokeApi(handle.win, ['backup', 'import'], backupPath, PASSWORD, 1);
  expect(imported.success).toBe(true);

  const res = await invokeApi(handle.win, ['company', 'get']);
  expect(res.success).toBe(true);
});

test('restaurar con contraseña incorrecta falla', async () => {
  const dir = downloadDir();
  const backupPath = `${dir}\\backup_e2e_${Date.now()}.db`;
  expect(
    (await invokeApi(handle.win, ['backup', 'export'], backupPath, PASSWORD, 1)).success,
  ).toBe(true);

  const imported = await invokeApi(handle.win, ['backup', 'import'], backupPath, 'clave-incorrecta', 1);
  expect(imported.success).toBe(false);
  expect(String(imported.error)).toMatch(/Contraseña incorrecta|no es un backup/);
});

test('la sección de backup menciona que requiere Pro', async () => {
  await freshNav(handle.win, '/settings');
  const card = handle.win.locator('.card', { hasText: 'Backup y restauración' });
  await expect(card.getByRole('button', { name: 'Exportar copia de seguridad' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Restaurar desde backup' })).toBeVisible();
});