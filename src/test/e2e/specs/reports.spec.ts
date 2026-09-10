import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, freshNav } from '../helpers/ui';
import { seedCategory, seedProduct, seedMovement, listProducts } from '../helpers/seed';
import { downloadDir, waitForDownloadSince } from '../helpers/fixtures';
import { saveDownloadsTo } from '../helpers/downloads';

let handle: AppHandle;
const exportsDir = downloadDir();

test.beforeAll(async () => {
  handle = await launchApp();
  await saveDownloadsTo(handle.app, exportsDir);

  const cat = await seedCategory(handle.win, 'Tecnología');
  const categoryId = (cat.data as { id: number }).id;

  await seedProduct(handle.win, {
    name: 'Laptop RPT',
    sku: 'LAP-R1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 2,
    cost_price: 1000,
    sale_price: 1500,
  });
  await seedProduct(handle.win, {
    name: 'Mouse RPT',
    sku: 'MOU-R1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 5,
    cost_price: 10,
    sale_price: 20,
  });

  const products = await listProducts(handle.win);
  const laptop = (products.data as Array<{ id: number; sku: string }>).find((p) => p.sku === 'LAP-R1')!;
  const mouse = (products.data as Array<{ id: number; sku: string }>).find((p) => p.sku === 'MOU-R1')!;
  await seedMovement(handle.win, { product_id: laptop.id, type: 'IN', quantity: 3, note: 'Compra' });
  await seedMovement(handle.win, { product_id: mouse.id, type: 'IN', quantity: 1, note: 'Compra' });

  await loginAdmin(handle.win);
});

test('el reporte resume productos, unidades y valor total', async () => {
  await freshNav(handle.win, '/reports');
  await expect(handle.win.locator('h1', { hasText: 'Reportes' })).toBeVisible();

  await expect(handle.win.getByText('Productos: 2')).toBeVisible({ timeout: 10_000 });
  await expect(handle.win.getByText('Unidades totales: 4')).toBeVisible();
  await expect(handle.win.getByText(/3[.,]010[.,]00/)).toBeVisible();

  const row = handle.win.locator('tr', { hasText: 'LAP-R1' });
  await expect(row.getByText('Laptop RPT')).toBeVisible();
  await expect(row.getByText('3 uds').first()).toBeVisible();
});

test('exporta el inventario actual a CSV', async () => {
  await freshNav(handle.win, '/reports');
  const since = Date.now();
  await handle.win.getByRole('button', { name: 'Exportar CSV' }).click();

  const file = waitForDownloadSince(exportsDir, since, 10_000, '.csv');
  expect(file.endsWith('.csv')).toBe(true);
  const content = fs.readFileSync(file, 'utf8');
  expect(content).toContain('Laptop RPT');
  expect(content).toContain('LAP-R1');
  expect(content).toContain('3000');
});

test('los botones Pro (PDF/CSV) están disponibles', async () => {
  await freshNav(handle.win, '/reports');
  await expect(handle.win.getByRole('button', { name: 'Exportar PDF' })).toBeVisible();
  await expect(handle.win.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
});