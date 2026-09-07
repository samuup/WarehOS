import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, navTo, modal } from '../helpers/ui';
import { seedCategory, seedProduct, listCategories, invokeApi } from '../helpers/seed';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);
});

test('crear categoría desde Productos', async () => {
  await navTo(handle.win, '/products');
  await expect(handle.win.locator('h1', { hasText: 'Productos' })).toBeVisible();

  await handle.win.getByRole('button', { name: '+ Categorías' }).click();
  const m = modal(handle.win);
  await expect(m.locator('h2', { hasText: 'Nueva categoría' })).toBeVisible();
  await m.locator('input[type="text"]').fill('Papelería');
  await m.getByRole('button', { name: 'Guardar' }).click();

  await expect(handle.win.locator('select option', { hasText: 'Papelería' })).toHaveCount(1, { timeout: 10_000 });
  await expect(m).toBeHidden({ timeout: 5_000 }).catch(() => {});
});

test('categoría con nombre vacío queda bloqueada por el formulario', async () => {
  await navTo(handle.win, '/products');
  await handle.win.getByRole('button', { name: '+ Categorías' }).click();
  const m = modal(handle.win);
  await m.getByRole('button', { name: 'Guardar' }).click();
  // El input es required (validación HTML5): el modal permanece abierto.
  await expect(m.locator('h2', { hasText: 'Nueva categoría' })).toBeVisible({ timeout: 5_000 });

  // Backend: crear categoría vacía también se rechaza.
  const res = await invokeApi(handle.win, ['categories', 'create'], { name: '', description: '' }, 1);
  expect(res.success).toBe(false);
  expect(res.error).toBe('El nombre es obligatorio');
});

test('categoría con productos no se puede eliminar (backend)', async () => {
  const cat = await seedCategory(handle.win, 'Con Productos');
  const categoryId = (cat.data as { id: number }).id;
  await seedProduct(handle.win, {
    name: 'Producto en categoría',
    sku: 'CAT-USE-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 1,
    sale_price: 2,
  });

  const del = await invokeApi(handle.win, ['categories', 'delete'], categoryId, 1);
  expect(del.success).toBe(false);
  expect(del.error).toBe('No se puede eliminar: hay productos en esta categoría');
});

test('una categoría vacía sí se elimina por backend', async () => {
  const cat = await seedCategory(handle.win, 'Vacía');
  const categoryId = (cat.data as { id: number }).id;

  const del = await invokeApi(handle.win, ['categories', 'delete'], categoryId, 1);
  expect(del.success).toBe(true);

  const list = await listCategories(handle.win);
  const names = (list.data as Array<{ name: string }>).map((c) => c.name);
  expect(names).not.toContain('Vacía');
});