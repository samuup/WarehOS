import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, navTo } from '../helpers/ui';
import { writeCsvFixture } from '../helpers/fixtures';

let handle: AppHandle;

test.beforeAll(async () => {
  handle = await launchApp();
  await loginAdmin(handle.win);
});

/**
 * La importación usa un diálogo nativo (dialog.showOpenDialog) en el proceso
 * main. Lo simulamos devolviendo una ruta de archivo de prueba.
 */
async function stubOpenDialog(filePath: string): Promise<void> {
  await handle.app.evaluate(({ dialog }, path_to_return) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path_to_return],
    });
  }, filePath);
}

test('importar CSV con encabezados en español (con duplicado omitido)', async () => {
  const csv = writeCsvFixture([
    ['nombre', 'sku', 'categoria', 'unidad', 'stock_inicial', 'costo', 'precio_venta'],
    ['Arroz Grano', 'AR-100', 'Alimentos', 'kg', '10', '3.5', '6.9'],
    ['Fideos Largos', 'FI-200', 'Alimentos', 'kg', '5', '2', '4.2'],
    ['Arroz Grano Extra', 'AR-100', 'Alimentos', 'kg', '3', '3.5', '7.0'],
  ]);
  await stubOpenDialog(csv);

  await navTo(handle.win, '/products');
  await handle.win.getByRole('button', { name: 'Importar' }).click();

  const modal = handle.win.locator('.fixed.inset-0').last();
  await expect(modal.locator('h2', { hasText: 'Resultado de importación' })).toBeVisible({ timeout: 20_000 });
  await expect(modal.getByText('Se importaron 2 productos')).toBeVisible();
  await expect(modal.getByText('Omitidos: 1')).toBeVisible();
  await expect(modal.getByText(/SKU duplicado \(omitido\): AR-100 - Arroz Grano Extra/)).toBeVisible();
  await modal.getByText('Cerrar', { exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 5_000 }).catch(() => {});
});

test('importar CSV con encabezados en inglés', async () => {
  const csv = writeCsvFixture([
    ['name', 'sku', 'category', 'unit', 'stock', 'cost', 'price'],
    ['Sugar', 'SU-1', 'Alimentos', 'kg', '20', '2', '3.5'],
    ['Salt', 'SA-1', 'Alimentos', 'kg', '8', '1', '2'],
  ]);
  await stubOpenDialog(csv);

  await navTo(handle.win, '/products');
  await handle.win.getByRole('button', { name: 'Importar' }).click();

  const modal = handle.win.locator('.fixed.inset-0').last();
  await expect(modal.locator('h2', { hasText: 'Resultado de importación' })).toBeVisible({ timeout: 20_000 });
  await expect(modal.getByText('Se importaron 2 productos')).toBeVisible();
  await expect(modal.getByText('Omitidos: 0')).toBeVisible();
  await modal.getByText('Cerrar', { exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 5_000 }).catch(() => {});
});

test('si no se selecciona archivo, se muestra un aviso', async () => {
  await handle.app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });

  await navTo(handle.win, '/products');
  await handle.win.getByRole('button', { name: 'Importar' }).click();

  const modal = handle.win.locator('.fixed.inset-0').last();
  await expect(modal.getByText('No se seleccionó ningún archivo.')).toBeVisible({ timeout: 20_000 });
  await modal.getByLabel('Cerrar').click();
  await expect(modal).toBeHidden({ timeout: 5_000 }).catch(() => {});
});