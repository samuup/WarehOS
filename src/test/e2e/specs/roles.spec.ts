import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, logout, freshNav, uiLogin } from '../helpers/ui';
import { invokeApi, seedCategory, seedProduct } from '../helpers/seed';

let handle: AppHandle;
let opId: number;
let viId: number;
let productId: number;
let categoryId: number;

test.beforeAll(async () => {
  handle = await launchApp();

  const cat = await seedCategory(handle.win, 'Tecno');
  categoryId = (cat.data as { id: number }).id;
  const prod = await seedProduct(handle.win, {
    name: 'Camiseta CLR',
    sku: 'CAM-CLR',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 10,
    sale_price: 25,
  });
  productId = (prod.data as { id: number }).id;

  const op = await invokeApi(handle.win, ['auth', 'register'], {
    name: 'Operador Uno',
    username: 'op1',
    password: 'op1pass1',
  }, 1);
  opId = (op.data as { id: number }).id;

  const vi = await invokeApi(handle.win, ['auth', 'register'], {
    name: 'Visor Uno',
    username: 'vi1',
    password: 'vi1pass1',
    role: 'viewer',
  }, 1);
  viId = (vi.data as { id: number }).id;

  await loginAdmin(handle.win);
});

test('el admin puede ver Usuarios y Configuración', async () => {
  await expect(handle.win.locator('nav').getByRole('link', { name: 'Usuarios' })).toBeVisible();
  await expect(handle.win.locator('nav').getByRole('link', { name: 'Configuración' })).toBeVisible();
  await freshNav(handle.win, '/users');
  await expect(handle.win.getByRole('button', { name: 'Nuevo usuario' })).toBeVisible();
});

test.describe('operador', () => {
  test.beforeEach(async () => {
    await logout(handle.win);
    await uiLogin(handle.win, 'op1', 'op1pass1');
  });

  test('ve productos y puede crearlos', async () => {
    await expect(handle.win.locator('nav').getByRole('link', { name: 'Productos' })).toBeVisible();
    await freshNav(handle.win, '/products');
    await expect(handle.win.getByText('Camiseta CLR')).toBeVisible();
    await expect(handle.win.getByRole('button', { name: 'Nuevo producto' })).toBeVisible();

    const res = await invokeApi(handle.win, ['products', 'create'], {
      name: 'Mochila OPR',
      sku: 'MO-OP1',
      category_id: categoryId,
      unit: 'uds',
      stock_min: 0,
      cost_price: 30,
      sale_price: 60,
    }, opId);
    expect(res.success).toBe(true);
  });

  test('puede registrar movimientos', async () => {
    const res = await invokeApi(handle.win, ['movements', 'create'], {
      product_id: productId,
      type: 'IN',
      quantity: 2,
      note: 'Entrada operador',
    }, opId);
    expect(res.success).toBe(true);
  });

  test('NO ve Usuarios ni Auditoría; sí ve Configuración', async () => {
    await expect(handle.win.locator('nav').getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    await expect(handle.win.locator('nav').getByRole('link', { name: 'Configuración' })).toBeVisible();
    await expect(handle.win.locator('nav').getByRole('link', { name: 'Auditoría' })).toHaveCount(0);

    await handle.win.evaluate(() => { window.location.hash = '#/users'; });
    await expect.poll(() => handle.win.evaluate(() => window.location.hash)).toBe('#/');
  });
});

test.describe('visor', () => {
  test.beforeEach(async () => {
    await logout(handle.win);
    await uiLogin(handle.win, 'vi1', 'vi1pass1');
  });

  test('ve productos y stock pero no puede crear ni editar', async () => {
    await freshNav(handle.win, '/products');
    await expect(handle.win.getByText('Camiseta CLR')).toBeVisible();
    await expect(handle.win.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0);

    const res = await invokeApi(handle.win, ['products', 'create'], {
      name: 'Mochila VSR',
      sku: 'MO-VS1',
      category_id: categoryId,
      unit: 'uds',
      stock_min: 0,
      cost_price: 30,
      sale_price: 60,
    }, viId);
    expect(res.success).toBe(false);
  });

  test('el backend rechaza movimientos para el visor', async () => {
    const res = await invokeApi(handle.win, ['movements', 'create'], {
      product_id: productId,
      type: 'IN',
      quantity: 2,
      note: 'Entrada visor',
    }, viId);
    expect(res.success).toBe(false);
  });

test('ve Inventario (movimientos) pero no puede registrar', async () => {
  await expect(handle.win.locator('nav').getByRole('link', { name: 'Inventario' })).toBeVisible();
  await expect(handle.win.locator('nav').getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  await expect(handle.win.locator('nav').getByRole('link', { name: 'Configuración' })).toBeVisible();

  await freshNav(handle.win, '/inventory');
  await expect(handle.win.locator('h1', { hasText: 'Movimientos de inventario' })).toBeVisible();
  await expect(handle.win.getByRole('button', { name: 'Registrar movimiento' })).toHaveCount(0);

  await handle.win.evaluate(() => { window.location.hash = '#/users'; });
  await expect.poll(() => handle.win.evaluate(() => window.location.hash)).toBe('#/');
});
});