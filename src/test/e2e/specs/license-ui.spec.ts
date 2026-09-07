import { test, expect } from '@playwright/test';
import type { Page } from 'playwright';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, navTo } from '../helpers/ui';

let pro: AppHandle;
let trial: AppHandle;

function licenseCard(win: Page) {
  return win.locator('.card').filter({ has: win.getByRole('heading', { name: 'Licencia' }) });
}

function updatesCard(win: Page) {
  return win.locator('.card').filter({ has: win.getByRole('heading', { name: 'Actualizaciones' }) });
}

test.beforeAll(async () => {
  pro = await launchApp({ forcePro: true });
  await loginAdmin(pro.win);
  await navTo(pro.win, '/settings');

  trial = await launchApp({ forcePro: false });
  await loginAdmin(trial.win);
  await navTo(trial.win, '/settings');
});

test.afterAll(async () => {
  if (pro) await pro.close();
  if (trial) await trial.close();
});

test('con licencia Pro la tarjeta de Licencia muestra la versión activada y el código de máquina', async () => {
  await expect(licenseCard(pro.win).getByText('Versión Pro activada')).toBeVisible({
    timeout: 10_000,
  });
  const code = (await licenseCard(pro.win).locator('code').innerText()).trim();
  expect(code.length).toBeGreaterThan(0);
  expect(code).not.toBe('Cargando...');
});

test('sin licencia se muestra el estado de prueba y el formulario de activación', async () => {
  await expect(licenseCard(trial.win).getByText(/te quedan \d+ días/)).toBeVisible({
    timeout: 10_000,
  });
  await expect(licenseCard(trial.win).getByText('Clave de licencia')).toBeVisible();
  await expect(licenseCard(trial.win).getByRole('button', { name: 'Activar licencia' })).toBeVisible();
});

test('la tarjeta de Actualizaciones muestra la versión instalada y avisa si no aplica', async () => {
  const card = updatesCard(pro.win);
  await expect(card.getByText(/Versión instalada: \S+/)).toBeVisible({ timeout: 10_000 });
  await expect(
    card.getByText('Solo disponible en la aplicación instalada.'),
  ).toBeVisible({ timeout: 10_000 });
  await expect(card.getByRole('button', { name: 'Buscar actualizaciones' })).toBeVisible();
});