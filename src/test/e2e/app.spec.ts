import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication } from 'playwright';

let app: ElectronApplication;
let win: Awaited<ReturnType<ElectronApplication['firstWindow']>>;
let userData: string;

test.beforeAll(async () => {
  userData = mkdtempSync(path.join(tmpdir(), 'warehos-e2e-'));
  app = await electron.launch({
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'production', WAREHOS_USER_DATA: userData },
  });
  win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await app?.close();
  if (userData) {
    rmSync(userData, { recursive: true, force: true });
  }
});

test('flujo completo: login, onboarding, categoría y producto desde cero', async () => {
  await expect(win.locator('h1', { hasText: 'WarehOS' })).toBeVisible({ timeout: 20_000 });

  await win.locator('input[type="text"], input[autocomplete="username"]').first().fill('admin');
  await win.locator('input[type="password"]').first().fill('admin123');
  await win.locator('button[type="submit"]', { hasText: 'Ingresar' }).first().click();

  // Onboarding wizard aparece para un admin sin empresa configurada.
  await expect(win.locator('h2', { hasText: 'Bienvenido a WarehOS' })).toBeVisible({ timeout: 20_000 });
  await win.getByRole('button', { name: 'Continuar' }).click();

  await win.locator('.fixed.inset-0').last().locator('input[type="text"]').first().fill('E2E Store S.A.C.');
  await win.getByRole('button', { name: 'Guardar y empezar' }).click();

  await expect(win.locator('h2', { hasText: 'Primeros pasos' })).toBeVisible({ timeout: 20_000 });

  // Crear categoría.
  await win.locator('a[href="#/products"]').click();
  await expect(win.locator('h1', { hasText: 'Productos' })).toBeVisible();
  await win.locator('button', { hasText: 'Categorías' }).click();
  await win.locator('.fixed.inset-0').last().locator('input[type="text"]').fill('Categoría E2E');
  await win.getByRole('button', { name: 'Guardar' }).last().click();
  await expect(
    win.locator('select option', { hasText: 'Categoría E2E' }),
  ).toHaveCount(1, { timeout: 10_000 });

  // Crear producto.
  await win.locator('button', { hasText: 'Nuevo producto' }).click();
  await expect(win.locator('h1', { hasText: 'Nuevo producto' })).toBeVisible();
  await win.locator('form input[type="text"]').nth(0).fill('Laptop E2E');
  await win.locator('form input[type="text"]').nth(1).fill('LAP-E2E-001');
  await win.locator('form input[type="number"]').nth(1).fill('1500');
  await win.locator('form input[type="number"]').nth(2).fill('1890');
  await win.locator('form select').nth(0).selectOption({ label: 'Categoría E2E' });
  await win.locator('button[type="submit"]', { hasText: 'Crear producto' }).click();

  // El formulario debe navegar de vuelta a la lista de productos.
  await expect(win.locator('h1', { hasText: 'Productos' })).toBeVisible({ timeout: 10_000 });
  await expect(win.getByText('Laptop E2E')).toBeVisible({ timeout: 10_000 });

  // El dashboard refleja el producto: queda pendiente solo el movimiento.
  await win.locator('a[href="#/"]').click();
  await expect(win.getByText('1 pendientes')).toBeVisible({ timeout: 10_000 });
});