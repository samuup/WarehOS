import type { Page } from 'playwright';

/**
 * Loguea a través de la UI de login. El primer campo de texto es el de
 * usuario (username), el de tipo password es la contraseña.
 */
export async function uiLogin(win: Page, username: string, password: string): Promise<void> {
  await win.locator('input[autocomplete="username"]').first().fill(username);
  await win.locator('input[type="password"]').first().fill(password);
  await win.getByRole('button', { name: 'Ingresar' }).click();
}

/**
 * El primer arranque con BD limpia muestra el asistente "Bienvenido a
 * WarehOS" para un admin sin empresa configurada. Lo completa si aparece.
 */
export async function completeOnboarding(win: Page): Promise<void> {
  const wizard = win.locator('h2', { hasText: 'Bienvenido a WarehOS' });
  if (await wizard.isVisible().catch(() => false)) {
    const modal = win.locator('.fixed.inset-0').last();
    await win.getByRole('button', { name: 'Continuar' }).click();
    await modal.locator('input[type="text"]').first().fill('E2E Store S.A.C.');
    await win.getByRole('button', { name: 'Guardar y empezar' }).click();
  }
}

/** Login como admin + completa el onboarding y espera el Dashboard. */
export async function loginAdmin(win: Page): Promise<void> {
  await uiLogin(win, 'admin', 'admin123');
  await completeOnboarding(win);
  await win.locator('h1', { hasText: 'Dashboard' }).waitFor({ timeout: 20_000 });
}

/** Cierra sesión desde el sidebar y espera volver al login. */
export async function logout(win: Page): Promise<void> {
  await win.getByRole('button', { name: 'Cerrar sesión' }).click();
  await win.locator('h2', { hasText: 'Iniciar sesión' }).waitFor({ timeout: 10_000 });
}

/** Navega por el menú lateral usando el hash route. */
export async function navTo(win: Page, hash: string): Promise<void> {
  await win.locator(`a[href="#${hash}"]`).first().click();
}

/**
 * Igual que navTo pero pasando primero por el Dashboard: fuerza el remount de
 * la página objetivo (los fetch de datos corren en el montaje), evitando leer
 * listas en caché tras sembrar datos nuevos.
 */
export async function freshNav(win: Page, hash: string): Promise<void> {
  await navTo(win, '/');
  await navTo(win, hash);
}

/** Devuelve el locator del modal más reciente (overlay .fixed.inset-0). */
export function modal(win: Page) {
  return win.locator('.fixed.inset-0').last();
}