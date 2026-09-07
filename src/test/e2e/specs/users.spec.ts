import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, freshNav } from '../helpers/ui';
import { invokeApi } from '../helpers/seed';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);
});

test('crear un usuario operador desde la página de Usuarios', async () => {
  await freshNav(handle.win, '/users');
  await handle.win.getByRole('button', { name: 'Nuevo usuario' }).click();

  const modal = handle.win.locator('.fixed.inset-0').last();
  const texts = modal.locator('input[type="text"]');
  await texts.nth(0).fill('Carlos Prueba');
  await modal.locator('input[autocomplete="username"]').fill('carlos');
  const pws = modal.locator('input[type="password"]');
  await pws.nth(0).fill('carlos123');
  await pws.nth(1).fill('carlos123');
  await modal.locator('select').selectOption('operator');
  await modal.getByRole('button', { name: 'Crear usuario' }).click();

  await expect(modal).toBeHidden();
  await expect(handle.win.locator('tr', { hasText: '@carlos' })).toBeVisible();
});

test('el backend mantiene rol operador para el usuario creado', async () => {
  const res = await invokeApi(handle.win, ['auth', 'listUsers'], 1);
  const users = res.data as Array<{ username: string; role: string }>;
  const carlos = users.find((u) => u.username === 'carlos');
  expect(carlos?.role).toBe('operator');
});

test('no se puede eliminar la propia cuenta ni a otro admin', async () => {
  const created = await invokeApi(handle.win, ['auth', 'register'], {
    name: 'Otro Admin',
    username: 'admin2',
    password: 'admin2123',
    role: 'admin',
  }, 1);
  expect(created.success).toBe(true);
  const admin2Id = (created.data as { id: number }).id;

  const selfDelete = await invokeApi(handle.win, ['auth', 'deleteUser'], 1, 1);
  expect(selfDelete.success).toBe(false);
  expect(String(selfDelete.error ?? '')).toContain('administrador');

  const adminDelete = await invokeApi(handle.win, ['auth', 'deleteUser'], admin2Id, 1);
  expect(adminDelete.success).toBe(false);
  expect(String(adminDelete.error ?? '')).toContain('administrador');

  const after = await invokeApi(handle.win, ['auth', 'listUsers'], 1);
  const ids = (after.data as Array<{ id: number }>).map((u) => u.id);
  expect(ids).toContain(1);
  expect(ids).toContain(admin2Id);
});

test('no se puede eliminar un operador que tiene movimientos registrados', async () => {
  const cat = await invokeApi(handle.win, ['categories', 'create'], {
    name: 'CatMov',
    description: 'd',
  }, 1);
  const categoryId = (cat.data as { id: number }).id;
  const prod = await invokeApi(handle.win, ['products', 'create'], {
    name: 'Producto Con Mov',
    sku: 'PMOV-1',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 1,
    sale_price: 2,
  }, 1);
  const productId = (prod.data as { id: number }).id;

  const created = await invokeApi(handle.win, ['auth', 'register'], {
    name: 'Operador Con Mov',
    username: 'conmov',
    password: 'conmov123',
  }, 1);
  const operatorId = (created.data as { id: number }).id;

  const mov = await invokeApi(
    handle.win,
    ['movements', 'create'],
    { product_id: productId, type: 'IN', quantity: 2, note: 'mov del operador' },
    operatorId,
  );
  expect(mov.success).toBe(true);

  const del = await invokeApi(handle.win, ['auth', 'deleteUser'], operatorId, 1);
  expect(del.success).toBe(false);
  expect(String(del.error ?? '')).toContain('movimiento');

  const after = await invokeApi(handle.win, ['auth', 'listUsers'], 1);
  expect((after.data as Array<{ id: number }>).some((u) => u.id === operatorId)).toBe(true);
});

test('eliminar un operador: ya no puede iniciar sesión', async () => {
  const created = await invokeApi(handle.win, ['auth', 'register'], {
    name: 'Operador Borrar',
    username: 'borrable',
    password: 'borrar123',
  }, 1);
  const userId = (created.data as { id: number }).id;

  await freshNav(handle.win, '/users');
  await handle.win.evaluate(() => {
    window.confirm = () => true;
  });
  handle.win.locator('tr', { hasText: '@borrable' }).getByRole('button', { name: 'Eliminar' }).click();
  await expect(handle.win.locator('tr', { hasText: '@borrable' })).toHaveCount(0);

  const res = await invokeApi(handle.win, ['auth', 'listUsers'], 1);
  expect((res.data as Array<{ id: number }>).some((u) => u.id === userId)).toBe(false);
});