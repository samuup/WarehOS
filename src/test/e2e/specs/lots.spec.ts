import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, navTo } from '../helpers/ui';
import { invokeApi, seedCategory, seedProduct } from '../helpers/seed';

let handle: AppHandle;
let productId: number;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);

  const cat = await seedCategory(handle.win, 'LotesCat');
  const categoryId = (cat.data as { id: number }).id;
  const yogurt = await seedProduct(handle.win, {
    name: 'Yogurt Fresa',
    sku: 'YGF-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 3,
    sale_price: 5,
    track_lots: true,
  });
  productId = (yogurt.data as { id: number }).id;
});

test('un producto con control de lotes exige número de lote en la entrada', async () => {
  const res = await invokeApi(handle.win, ['movements', 'create'], {
    product_id: productId,
    type: 'IN',
    quantity: 5,
    note: 'sin lote',
  }, 1);
  expect(res.success).toBe(false);
  expect(String(res.error ?? '')).toContain('controla lotes');
});

test('entrada con lote registra el lote y su vencimiento', async () => {
  const mov = await invokeApi(handle.win, ['movements', 'create'], {
    product_id: productId,
    type: 'IN',
    quantity: 4,
    note: 'lote próximo a vencer',
    batch: 'L-001',
    expiry_date: daysFromNow(2),
  }, 1);
  expect(mov.success).toBe(true);

  const lots = await invokeApi(handle.win, ['lots', 'list'], productId);
  expect(lots.success).toBe(true);
  const list = lots.data as Array<{ batch: string; quantity: number; expiry_date: string | null }>;
  const found = list.find((l) => l.batch === 'L-001');
  expect(found).toBeDefined();
  expect(found?.quantity).toBe(4);
  expect(found?.expiry_date).toBe(daysFromNow(2));
});

test('la entrada con lote sin vencimiento también se acepta', async () => {
  const mov = await invokeApi(handle.win, ['movements', 'create'], {
    product_id: productId,
    type: 'IN',
    quantity: 2,
    note: 'lote sin fecha',
    batch: 'L-002',
  }, 1);
  expect(mov.success).toBe(true);

  const lots = await invokeApi(handle.win, ['lots', 'list'], productId);
  const list = lots.data as Array<{ batch: string; expiry_date: string | null }>;
  expect(list.find((l) => l.batch === 'L-002')?.expiry_date).toBeNull();
});

test('el lote por vencer aparece en el panel del dashboard', async () => {
  const stamp = Date.now();
  const cat = await seedCategory(handle.win, 'DashLotesCat');
  const categoryId = (cat.data as { id: number }).id;
  const p = await seedProduct(handle.win, {
    name: 'Yogurt Dashboard',
    sku: `YGD-${stamp}`,
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 3,
    sale_price: 5,
    track_lots: true,
  });
  const pid = (p.data as { id: number }).id;

  const expiring = await invokeApi(handle.win, ['lots', 'expiring']);
  expect(expiring.success).toBe(true);
  const list = expiring.data as Array<{ batch: string; product_id: number; days_left: number; status: string }>;
  expect(list.find((l) => l.batch === 'DASH-1' && l.product_id === pid)).toBeUndefined();

  const mov = await invokeApi(handle.win, ['movements', 'create'], {
    product_id: pid,
    type: 'IN',
    quantity: 4,
    note: 'lote para dashboard',
    batch: 'DASH-1',
    expiry_date: daysFromNow(2),
  }, 1);
  expect(mov.success).toBe(true);

  const afterSeed = await invokeApi(handle.win, ['lots', 'expiring']);
  const found = (afterSeed.data as Array<{ batch: string; product_id: number; status: string }>).find(
    (l) => l.batch === 'DASH-1' && l.product_id === pid,
  );
  expect(found).toBeDefined();
  expect(found?.status).toBe('near');

  await navTo(handle.win, '/products');
  await navTo(handle.win, '/');
  await expect(handle.win.locator('h2', { hasText: 'Lotes por vencer' })).toBeVisible({ timeout: 15_000 });
  const card = handle.win.locator('div', { hasText: 'Yogurt Dashboard' }).filter({ hasText: 'DASH-1' });
  await expect(card.first()).toBeVisible({ timeout: 10_000 });
});