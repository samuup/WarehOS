import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, freshNav, modal } from '../helpers/ui';
import { seedCategory, seedProduct, invokeApi } from '../helpers/seed';

let handle: AppHandle;
let productId: number;
let webcamId: number;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);

  const cat = await seedCategory(handle.win, 'MovCat');
  const categoryId = (cat.data as { id: number }).id;
  const teclado = await seedProduct(handle.win, {
    name: 'Teclado Gamer',
    sku: 'TEC-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 1,
    cost_price: 30,
    sale_price: 55,
  });
  productId = (teclado.data as { id: number }).id;
  const webcam = await seedProduct(handle.win, {
    name: 'Webcam',
    sku: 'WBM-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 2,
    sale_price: 4,
  });
  webcamId = (webcam.data as { id: number }).id;

  const wh2 = await invokeApi(
    handle.win,
    ['warehouses', 'create'],
    { name: 'Secundario', address: 'Calle 2' },
    1,
  );
  expect(wh2.success).toBe(true);
});

test('registrar una entrada y verla en la lista', async () => {
  await freshNav(handle.win, '/inventory');
  await handle.win.getByRole('button', { name: 'Registrar movimiento' }).click();
  const m = modal(handle.win);
  await expect(m.locator('h2', { hasText: 'Registrar movimiento de stock' })).toBeVisible();

  await m.locator('select').nth(0).selectOption({ value: String(productId) });
  await m.locator('input[type="number"]').fill('3');
  await m.locator('textarea').fill('Compra teclados');
  await m.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(m).toBeHidden({ timeout: 5_000 });

  const row = handle.win.locator('tr', { hasText: 'TEC-1' });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await expect(row.getByText('+ 3').first()).toBeVisible();
  await expect(row.getByText('Entrada').first()).toBeVisible();
});

test('registrar una salida', async () => {
  await freshNav(handle.win, '/inventory');
  await handle.win.getByRole('button', { name: 'Registrar movimiento' }).click();
  const m = modal(handle.win);
  await m.locator('select').nth(0).selectOption({ value: String(productId) });
  await m.getByText('Salida', { exact: true }).click();
  await m.locator('input[type="number"]').fill('1');
  await m.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(m).toBeHidden({ timeout: 5_000 });

  const row = handle.win.locator('tr', { hasText: 'TEC-1' });
  await expect(row.getByText('- 1').first()).toBeVisible({ timeout: 10_000 });
});

test('registrar un ajuste (nuevo stock)', async () => {
  await freshNav(handle.win, '/inventory');
  await handle.win.getByRole('button', { name: 'Registrar movimiento' }).click();
  const m = modal(handle.win);
  await m.locator('select').nth(0).selectOption({ value: String(productId) });
  await m.getByText('Ajuste', { exact: true }).click();
  await m.locator('input[type="number"]').fill('5');
  await m.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(m).toBeHidden({ timeout: 5_000 });

  const row = handle.win.locator('tr', { hasText: 'TEC-1' });
  await expect(row.getByText('= 5').first()).toBeVisible({ timeout: 10_000 });
});

test('transferencia entre almacenes', async () => {
  await freshNav(handle.win, '/inventory');
  await handle.win.getByRole('button', { name: 'Registrar movimiento' }).click();
  const m = modal(handle.win);
  await m.locator('select').nth(0).selectOption({ value: String(productId) });
  await m.getByText('Transferencia', { exact: true }).click();
  await m.locator('select').nth(2).selectOption({ label: 'Secundario' });
  await m.locator('input[type="number"]').fill('1');
  await m.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(m).toBeHidden({ timeout: 5_000 });

  const row = handle.win.locator('tr', { hasText: 'TEC-1' });
  await expect(row.getByText('Almacén Principal').first()).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText('Secundario').first()).toBeVisible();
});

test('salida con stock insuficiente muestra error en el modal', async () => {
  await freshNav(handle.win, '/inventory');
  await handle.win.getByRole('button', { name: 'Registrar movimiento' }).click();
  const m = modal(handle.win);
  await m.locator('select').nth(0).selectOption({ value: String(webcamId) });
  await m.getByText('Salida', { exact: true }).click();
  await m.locator('input[type="number"]').fill('5');
  await m.getByRole('button', { name: 'Registrar', exact: true }).click();

  await expect(m.getByText('Stock insuficiente. Stock actual: 0')).toBeVisible({ timeout: 10_000 });
  await expect(m.locator('h2', { hasText: 'Registrar movimiento de stock' })).toBeVisible();
  await m.getByLabel('Cerrar').click();
  await expect(m).toBeHidden({ timeout: 5_000 });
});

test('filtro por tipo: solo entradas', async () => {
  await freshNav(handle.win, '/inventory');
  const typeSelect = handle.win.locator('select').first();
  await typeSelect.selectOption('IN');

  await expect(handle.win.locator('tr', { hasText: '+ 3' })).toHaveCount(1, { timeout: 10_000 });
  await expect(handle.win.locator('tr', { hasText: '- 1' })).toHaveCount(0);
  await expect(handle.win.locator('tr', { hasText: '= 5' })).toHaveCount(0);
});