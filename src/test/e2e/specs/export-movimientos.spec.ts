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

  const cat = await seedCategory(handle.win, 'ExpCat');
  const categoryId = (cat.data as { id: number }).id;
  await seedProduct(handle.win, {
    name: 'Audífonos',
    sku: 'AUD-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 40,
    sale_price: 80,
  });

  const products = await listProducts(handle.win);
  const prod = (products.data as Array<{ id: number; sku: string }>).find((p) => p.sku === 'AUD-1')!;
  await seedMovement(handle.win, { product_id: prod.id, type: 'IN', quantity: 2, note: 'Lote inicial' });

  await loginAdmin(handle.win);
});

test('exportar movimientos a CSV con el botón Pro', async () => {
  await freshNav(handle.win, '/inventory');
  const since = Date.now();
  await handle.win.getByRole('button', { name: 'Exportar CSV' }).click();

  const file = waitForDownloadSince(exportsDir, since, 10_000, '.csv');
  expect(file.endsWith('.csv')).toBe(true);
  const content = fs.readFileSync(file, 'utf8');
  expect(content).toContain('Audífonos');
  expect(content).toContain('AUD-1');
  expect(content).toContain('Entrada');
});

test('exportar movimientos a PDF', async () => {
  await freshNav(handle.win, '/inventory');
  const since = Date.now();
  await handle.win.getByRole('button', { name: 'Exportar PDF' }).click();

  const file = waitForDownloadSince(exportsDir, since, 10_000, '.pdf');
  expect(file.endsWith('.pdf')).toBe(true);
  const head = fs.readFileSync(file).subarray(0, 5).toString('latin1');
  expect(head).toBe('%PDF-');
});