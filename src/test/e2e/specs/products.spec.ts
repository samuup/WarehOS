import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, navTo, freshNav } from '../helpers/ui';
import { seedCategory, seedProduct, seedMovement, invokeApi } from '../helpers/seed';

let handle: AppHandle;
let categoryId: number;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);
  const cat = await seedCategory(handle.win, 'Tecnología');
  categoryId = (cat.data as { id: number }).id;
});

test('crear producto completo desde el formulario', async () => {
  await navTo(handle.win, '/products');
  await handle.win.getByRole('button', { name: 'Nuevo producto' }).click();
  await expect(handle.win.locator('h1', { hasText: 'Nuevo producto' })).toBeVisible();

  const form = handle.win.locator('form');
  await form.locator('input[type="text"]').nth(0).fill('Laptop E2E');
  await form.locator('input[type="text"]').nth(1).fill('LAP-999');
  await form.locator('input[type="number"]').nth(0).fill('3');
  await form.locator('input[type="number"]').nth(1).fill('1000');
  await form.locator('input[type="number"]').nth(2).fill('1500');
  await form.locator('select').nth(0).selectOption({ value: String(categoryId) });

  await handle.win.getByRole('button', { name: 'Crear producto' }).click();

  await expect(handle.win.locator('h1', { hasText: 'Productos' })).toBeVisible({ timeout: 10_000 });
  const row = handle.win.locator('tr', { hasText: 'LAP-999' });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await expect(row.getByText('Laptop E2E')).toBeVisible();
});

test('SKU duplicado da error en el formulario', async () => {
  await navTo(handle.win, '/products');
  await handle.win.getByRole('button', { name: 'Nuevo producto' }).click();
  const form = handle.win.locator('form');
  await form.locator('input[type="text"]').nth(0).fill('Otro Laptop');
  await form.locator('input[type="text"]').nth(1).fill('LAP-999');
  await form.locator('select').nth(0).selectOption({ value: String(categoryId) });
  await handle.win.getByRole('button', { name: 'Crear producto' }).click();

  await expect(handle.win.getByText('El SKU ya existe')).toBeVisible({ timeout: 10_000 });
  await expect(handle.win.locator('h1', { hasText: 'Nuevo producto' })).toBeVisible();
});

test('editar producto y guardar cambios', async () => {
  await navTo(handle.win, '/products');
  const row = handle.win.locator('tr', { hasText: 'LAP-999' });
  await row.getByText('Editar').click();
  await expect(handle.win.locator('h1', { hasText: 'Editar producto' })).toBeVisible();

  await handle.win.locator('form input[type="number"]').nth(2).fill('2000');
  await handle.win.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(handle.win.locator('h1', { hasText: 'Productos' })).toBeVisible({ timeout: 10_000 });
  const updated = handle.win.locator('tr', { hasText: 'LAP-999' });
  await expect(updated.getByText('S/ 2,000.00').first()).toBeVisible({ timeout: 10_000 });
});

test('eliminar producto sin movimientos', async () => {
  await seedProduct(handle.win, {
    name: 'Borrar Sin Movs',
    sku: 'DEL-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 1,
    sale_price: 2,
  });
  await freshNav(handle.win, '/products');

  const row = handle.win.locator('tr', { hasText: 'DEL-1' });
  await row.getByText('Eliminar').click();
  await expect(handle.win.locator('tr', { hasText: 'DEL-1' })).toHaveCount(0, { timeout: 10_000 });
});

test('eliminar producto con movimientos queda bloqueado', async () => {
  const p = await seedProduct(handle.win, {
    name: 'Con Movs',
    sku: 'DEL-2',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 5,
    sale_price: 8,
  });
  const productId = (p.data as { id: number }).id;
  await seedMovement(handle.win, { product_id: productId, type: 'IN', quantity: 2 });

  await freshNav(handle.win, '/products');
  const row = handle.win.locator('tr', { hasText: 'DEL-2' });
  await row.getByText('Eliminar').click();

  await expect(
    handle.win.getByText('No se puede eliminar: el producto tiene movimientos registrados'),
  ).toBeVisible({ timeout: 10_000 });
  await expect(handle.win.locator('tr', { hasText: 'DEL-2' })).toHaveCount(1);
});

test('búsqueda por nombre y por SKU', async () => {
  await seedProduct(handle.win, {
    name: 'Monitor 24"',
    sku: 'MON-24',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 1,
    sale_price: 2,
  });
  await seedProduct(handle.win, {
    name: 'Monitor 27"',
    sku: 'MON-27',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 1,
    sale_price: 2,
  });

  await freshNav(handle.win, '/products');
  const search = handle.win.locator('input[placeholder="Buscar por nombre, SKU o código de barras..."]');

  await search.fill('Monitor');
  await expect(handle.win.locator('tr', { hasText: 'MON-24' })).toHaveCount(1, { timeout: 10_000 });
  await expect(handle.win.locator('tr', { hasText: 'MON-27' })).toHaveCount(1);

  await search.fill('MON-27');
  await expect(handle.win.locator('tr', { hasText: 'MON-24' })).toHaveCount(0);
  await expect(handle.win.locator('tr', { hasText: 'MON-27' })).toHaveCount(1);
});

test('filtro por categoría', async () => {
  const other = await seedCategory(handle.win, 'Oficina');
  const officeId = (other.data as { id: number }).id;
  await seedProduct(handle.win, {
    name: 'Silla',
    sku: 'SILLA-1',
    category_id: officeId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 1,
    sale_price: 2,
  });

  await freshNav(handle.win, '/products');
  const filter = handle.win
    .locator('select')
    .filter({ has: handle.win.locator('option', { hasText: 'Todas las categorías' }) });
  await expect(filter.locator('option', { hasText: 'Oficina' })).toHaveCount(1, { timeout: 10_000 });
  await filter.selectOption({ label: 'Oficina' });

  await expect(handle.win.locator('tr', { hasText: 'SILLA-1' })).toHaveCount(1, { timeout: 10_000 });
  await expect(handle.win.locator('tr', { hasText: 'LAP-999' })).toHaveCount(0);
});

test('el listado de productos responde por el backend', async () => {
  const res = await invokeApi(handle.win, ['products', 'list']);
  expect(res.success).toBe(true);
  expect((res.data as unknown[]).length).toBeGreaterThan(0);
});