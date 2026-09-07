import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, freshNav } from '../helpers/ui';
import { seedCategory, seedProduct, seedMovement, listProducts } from '../helpers/seed';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
  const cat = await seedCategory(handle.win, 'Embalaje');
  const categoryId = (cat.data as { id: number }).id;
  const prod = await seedProduct(handle.win, {
    name: 'Bolsa Kraft',
    sku: 'BOL-KRT',
    category_id: categoryId,
    unit: 'cajas',
    stock_min: 0,
    cost_price: 5,
    sale_price: 12,
  });
  const products = await listProducts(handle.win);
  const id = (prod.data as { id: number }).id;
  const stocked = await seedMovement(handle.win, { product_id: id, type: 'IN', quantity: 5, note: 'Stock unidad' });
  expect(stocked.success).toBe(true);
  expect(products.success).toBe(true);
  await loginAdmin(handle.win);
});

test('la unidad personalizada se respeta en el stock', async () => {
  await freshNav(handle.win, '/products');
  const row = handle.win.locator('tr', { hasText: 'BOL-KRT' });
  await expect(row).toBeVisible();
  await expect(row.getByText('5 cajas').first()).toBeVisible();
});