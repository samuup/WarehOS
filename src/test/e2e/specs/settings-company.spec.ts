import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, freshNav } from '../helpers/ui';
import { invokeApi, seedCategory, seedProduct } from '../helpers/seed';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
  const cat = await seedCategory(handle.win, 'Tecno');
  const categoryId = (cat.data as { id: number }).id;
  await seedProduct(handle.win, {
    name: 'Laptop STG',
    sku: 'LAP-STG',
    category_id: categoryId,
    unit: 'uds',
    stock_min: 0,
    cost_price: 1000,
    sale_price: 1500,
  });
  await loginAdmin(handle.win);
});

test('los datos de la empresa vienen del onboarding', async () => {
  const res = await invokeApi(handle.win, ['company', 'get']);
  expect(res.success).toBe(true);
  expect((res.data as { name: string }).name).toBe('E2E Store S.A.C.');
});

test('guardar dirección, teléfono, email y RUC persiste', async () => {
  await freshNav(handle.win, '/settings');
  const card = handle.win.locator('.card', { hasText: 'Datos de la empresa' });
  const texts = card.locator('input[type="text"]');
  await texts.nth(1).fill('Av. Prueba 456');
  await texts.nth(2).fill('+51 987 654 321');
  await texts.nth(3).fill('20512345678');
  await card.locator('input[type="email"]').fill('ventas@e2e.com');
  await card.getByRole('button', { name: 'Guardar empresa' }).click();

  await expect(handle.win.getByText('Datos guardados correctamente')).toBeVisible();

  const res = await invokeApi(handle.win, ['company', 'get']);
  const data = res.data as { address: string; tax_id: string; email: string };
  expect(data.address).toBe('Av. Prueba 456');
  expect(data.tax_id).toBe('20512345678');
  expect(data.email).toBe('ventas@e2e.com');
});

test('cambiar moneda a USD y ver el símbolo en el dashboard', async () => {
  await freshNav(handle.win, '/settings');
  const card = handle.win.locator('.card', { hasText: 'Datos de la empresa' });
  await card.locator('select').selectOption('USD');
  await card.getByRole('button', { name: 'Guardar empresa' }).click();
  await expect(handle.win.getByText('Datos guardados correctamente')).toBeVisible();

  const res = await invokeApi(handle.win, ['company', 'get']);
  expect((res.data as { currency: string }).currency).toBe('USD');

  await freshNav(handle.win, '/');
  const valueCard = handle.win.locator('.card', { hasText: 'Valor total' });
  await expect(valueCard.locator('p.text-2xl')).toContainText('$');
});