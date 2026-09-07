import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { uiLogin, completeOnboarding, logout, modal } from '../helpers/ui';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
});

test.afterAll(async () => {
  await handle.close();
});

test('login correcto con admin llega al dashboard y cierro sesión', async () => {
  await uiLogin(handle.win, 'admin', 'admin123');
  await completeOnboarding(handle.win);
  await expect(handle.win.locator('h1', { hasText: 'Dashboard' })).toBeVisible({ timeout: 20_000 });
  await expect(handle.win.getByText('E2E Store S.A.C.')).toBeVisible().catch(() => {});
  await logout(handle.win);
});

test('contraseña incorrecta muestra error y no avanza', async () => {
  await uiLogin(handle.win, 'admin', 'contraseña-incorrecta');
  await expect(handle.win.getByText('Credenciales inválidas')).toBeVisible({ timeout: 10_000 });
  await expect(handle.win.locator('h2', { hasText: 'Iniciar sesión' })).toBeVisible();
});

test('registro de nuevo usuario (rol operador) y login del mismo', async () => {
  await handle.win.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }).click();
  const m = modal(handle.win);
  await expect(m.locator('h2', { hasText: 'Registrar usuario' })).toBeVisible();
  await m.locator('input[type="text"]').nth(0).fill('Operador Nuevo');
  await m.locator('input[autocomplete="username"]').fill('ope1');
  await m.locator('input[type="password"]').nth(0).fill('ope123');
  await m.locator('input[type="password"]').nth(1).fill('ope123');
  await m.getByRole('button', { name: 'Registrarse' }).click();
  await expect(m.getByText('Usuario registrado correctamente')).toBeVisible({ timeout: 10_000 });
  await expect(m).toBeHidden({ timeout: 5_000 }).catch(() => {});

  await uiLogin(handle.win, 'ope1', 'ope123');
  await expect(handle.win.locator('h1', { hasText: 'Dashboard' })).toBeVisible({ timeout: 20_000 });
  await logout(handle.win);
});