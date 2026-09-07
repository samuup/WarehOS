import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { logout, uiLogin } from '../helpers/ui';
import { invokeApi } from '../helpers/seed';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();

  const reg = await invokeApi(handle.win, ['auth', 'register'], {
    name: 'Usuario Recuperación',
    username: 'rec1',
    password: 'rec123',
  });
  const recId = (reg.data as { id: number }).id;
  const sq = await invokeApi(handle.win, ['auth', 'setSecurityQuestion'], {
    userId: recId,
    question: '¿Cuál es tu ciudad de nacimiento?',
    answer: 'Lima',
  });
  expect(sq.success).toBe(true);

  await invokeApi(handle.win, ['auth', 'register'], {
    name: 'Sin Pregunta',
    username: 'rec2',
    password: 'rec123',
  });
});

test('restablecer contraseña respondiendo la pregunta de seguridad', async () => {
  await handle.win.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();

  const modal = handle.win.locator('.fixed.inset-0').last();
  await modal.locator('input[autocomplete="username"]').fill('rec1');
  await modal.getByRole('button', { name: 'Continuar' }).click();

  await expect(modal.getByText('¿Cuál es tu ciudad de nacimiento?')).toBeVisible();
  await modal.getByText('Tu respuesta').locator('..').getByRole('textbox').fill('Lima');
  await modal.getByRole('button', { name: 'Validar respuesta' }).click();

  const pws = modal.locator('input[type="password"]');
  await pws.nth(0).fill('rec456new');
  await pws.nth(1).fill('rec456new');
  await modal.getByRole('button', { name: 'Restablecer contraseña' }).click();

  await expect(handle.win.getByText('Contraseña restablecida correctamente')).toBeVisible();
  await handle.win.getByRole('button', { name: 'Iniciar sesión' }).click();

  await uiLogin(handle.win, 'rec1', 'rec456new');
  await expect(handle.win.locator('h1', { hasText: 'Dashboard' })).toBeVisible();
});

test('la contraseña anterior deja de funcionar', async () => {
  await logout(handle.win);
  await uiLogin(handle.win, 'rec1', 'rec123');
  await expect(handle.win.getByText('Credenciales inválidas')).toBeVisible();
});

test('un usuario sin pregunta configurada no puede recuperar', async () => {
  await handle.win.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  const modal = handle.win.locator('.fixed.inset-0').last();
  await modal.locator('input[autocomplete="username"]').fill('rec2');
  await modal.getByRole('button', { name: 'Continuar' }).click();

  await expect(
    modal.getByText('No hay pregunta de seguridad configurada para este usuario. Contacta al administrador.'),
  ).toBeVisible();
});

test('bloquea la recuperación tras 5 respuestas incorrectas', async () => {
  const closeBtn = handle.win.getByLabel('Cerrar');
  if (await closeBtn.count()) {
    await closeBtn.last().click();
  }

  for (let i = 0; i < 5; i++) {
    const res = await invokeApi(handle.win, ['auth', 'resetPassword'], {
      username: 'rec1',
      answer: 'Roma',
      newPassword: 'rec456new',
    });
    expect(res.success).toBe(false);
  }

  await handle.win.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  const modal = handle.win.locator('.fixed.inset-0').last();
  await modal.locator('input[autocomplete="username"]').fill('rec1');
  await modal.getByRole('button', { name: 'Continuar' }).click();
  await expect(modal.getByText('¿Cuál es tu ciudad de nacimiento?')).toBeVisible();

  await modal.getByText('Tu respuesta').locator('..').getByRole('textbox').fill('Lima');
  await modal.getByRole('button', { name: 'Validar respuesta' }).click();
  const pws = modal.locator('input[type="password"]');
  await pws.nth(0).fill('rec456new');
  await pws.nth(1).fill('rec456new');
  await modal.getByRole('button', { name: 'Restablecer contraseña' }).click();
  await expect(modal.getByText(/Demasiados intentos fallidos/)).toBeVisible();
});