import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, navTo } from '../helpers/ui';
import { seedCategory, seedProduct, seedMovement, listProducts } from '../helpers/seed';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();

  // Se siembra ANTES de iniciar sesión: el Dashboard se monta al entrar y
  // cachea el summary en el store (no lo refresca al re-navegar a la misma
  // ruta). Si sembráramos después, veríamos números en 0.
  const cat = await seedCategory(handle.win, 'Tecnología');
  const categoryId = (cat.data as { id: number }).id;

  await seedProduct(handle.win, {
    name: 'Laptop E2E',
    sku: 'LAP-DASH-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 2,
    cost_price: 1000,
    sale_price: 1500,
  });
  await seedProduct(handle.win, {
    name: 'Mouse E2E',
    sku: 'MOU-DASH-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 5,
    cost_price: 10,
    sale_price: 20,
  });

  const products = await listProducts(handle.win);
  const laptop = (products.data as Array<{ id: number; sku: string }>).find((p) => p.sku === 'LAP-DASH-1')!;
  const mouse = (products.data as Array<{ id: number; sku: string }>).find((p) => p.sku === 'MOU-DASH-1')!;

  await seedMovement(handle.win, { product_id: laptop.id, type: 'IN', quantity: 3, note: 'Compra inicial' });
  await seedMovement(handle.win, { product_id: mouse.id, type: 'IN', quantity: 1, note: 'Compra inicial' });

  await loginAdmin(handle.win);
});

test('métricas: productos, valor total y stock bajo', async () => {
  await navTo(handle.win, '/');

  const productos = handle.win.locator('.card', { hasText: 'Productos registrados' });
  await expect(productos.locator('p.text-2xl')).toHaveText('2', { timeout: 10_000 });

  const valor = handle.win.locator('.card', { hasText: 'Valor total del inventario' });
  await expect(valor.locator('p.text-2xl')).toContainText('3,010.00', { timeout: 10_000 });

  const bajo = handle.win.locator('.card', { hasText: 'Productos con stock bajo' });
  await expect(bajo.locator('p.text-2xl')).toHaveText('1', { timeout: 10_000 });
});

test('lista de stock bajo y movimientos recientes', async () => {
  await navTo(handle.win, '/');

  const lowStock = handle.win.locator('.card', { hasText: 'Productos con stock bajo' }).last();
  await expect(lowStock.getByText('Mouse E2E')).toBeVisible({ timeout: 10_000 });
  await expect(lowStock.getByText('SKU: MOU-DASH-1')).toBeVisible();

  const recentes = handle.win.locator('.card', { hasText: 'Movimientos recientes' });
  await expect(recentes.getByText('Entrada').first()).toBeVisible({ timeout: 10_000 });
  await expect(recentes.getByText('Laptop E2E').first()).toBeVisible();
  await expect(recentes.getByText('+ 3').first()).toBeVisible();
  await expect(recentes.getByText('Stock: 3').first()).toBeVisible();
});