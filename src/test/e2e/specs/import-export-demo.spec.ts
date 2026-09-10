import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { test, expect } from '@playwright/test';
import { launchApp, type AppHandle } from '../helpers/launch';
import { loginAdmin, freshNav } from '../helpers/ui';
import { saveDownloadsTo } from '../helpers/downloads';
import { waitForDownloadSince } from '../helpers/fixtures';
import { seedCategory, seedProduct, seedMovement, seedCompany, listProducts, listMovements } from '../helpers/seed';

let handle: AppHandle;

// Los artefactos de esta demo se guardan en el escritorio del usuario:
//   Desktop/warehos-demo/<ejecucion>/exportes/   -> CSV/PDF generados por la app
//   Desktop/warehos-demo/<ejecucion>/capturas/   -> capturas de cómo quedó en la app
//   Desktop/warehos-demo/<ejecucion>/importacion/ -> CSV de importación reutilizable
const STAMP = `demo-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
const RUN_DIR = path.join(os.homedir(), 'Desktop', 'warehos-demo', STAMP);
const EXPORT_DIR = path.join(RUN_DIR, 'exportes');
const SHOT_DIR = path.join(RUN_DIR, 'capturas');
const IMPORT_DIR = path.join(RUN_DIR, 'importacion');
const IMPORT_CSV = path.join(IMPORT_DIR, 'importar_productos_ejemplo.csv');

function stubOpenDialog(filePath: string): Promise<void> {
  return handle.app.evaluate(({ dialog }, pathToReturn) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [pathToReturn],
    });
  }, filePath);
}

test.beforeAll(async () => {
  for (const dir of [RUN_DIR, EXPORT_DIR, SHOT_DIR, IMPORT_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  handle = await launchApp();
  await saveDownloadsTo(handle.app, EXPORT_DIR);
  await loginAdmin(handle.win);

  await seedCompany(handle.win, {
    name: 'Abasto El Progreso C.A.',
    tax_id: 'J-12345678-9',
    phone: '0212-555-1234',
    email: 'contacto@abastoelprogreso.com',
    address: 'Av. Principal, Sector Las Acacias, Caracas',
    currency: 'VES',
  });

  const food = (await seedCategory(handle.win, 'Alimentos')).data as { id: number };
  const drinks = (await seedCategory(handle.win, 'Bebidas')).data as { id: number };
  const cleaning = (await seedCategory(handle.win, 'Limpieza y Hogar')).data as { id: number };

  const catalog = [
    ['Harina PAN', 'HP-2748', food.id, 'kg', 'FP-1001', 1.2, 1.55],
    ['Café Tradición 250g', 'CT-8810', food.id, 'kg', 'CT-1002', 1.7, 2.2],
    ['Arroz Blanco Premium 1kg', 'AR-5561', food.id, 'kg', 'AR-1003', 1.1, 1.45],
    ['Aceite Vegetal 1L', 'AC-3302', food.id, 'l', 'AC-1004', 1.5, 2.05],
    ['Azúcar Refinada 1kg', 'AZ-1109', food.id, 'kg', 'AZ-1005', 0.95, 1.25],
    ['Agua Mineral 2L', 'AG-2021', drinks.id, 'l', '', 0.55, 0.8],
    ['Refresco de Cola 2L', 'RE-4405', drinks.id, 'l', 'RE-1007', 1.3, 1.8],
    ['Jabón en Polvo 1kg', 'JB-7782', cleaning.id, 'kg', 'JB-1008', 1.05, 1.6],
  ] as const;

  for (const [name, sku, category_id, unit, barcode, cost_price, sale_price] of catalog) {
    await seedProduct(handle.win, {
      name,
      sku,
      category_id,
      unit,
      barcode,
      cost_price,
      sale_price,
      stock_min: 2,
      current_stock: 0,
    });
  }

  const products = (await listProducts(handle.win)).data as Array<{ id: number; sku: string }>;
  const bySku = new Map(products.map((p) => [p.sku, p]));

  const initial = ['HP-2748', 'CT-8810', 'AR-5561', 'AC-3302', 'AZ-1109', 'AG-2021', 'RE-4405', 'JB-7782'];
  for (const [i, sku] of initial.entries()) {
    await seedMovement(handle.win, {
      product_id: bySku.get(sku)!.id,
      type: 'IN',
      quantity: 10 + i * 3,
      note: 'Lote inicial de abastecimiento',
    });
  }
  await seedMovement(handle.win, {
    product_id: bySku.get('HP-2748')!.id,
    type: 'OUT',
    quantity: 5,
    note: 'Venta mostrador',
  });

  // CSV de importación reutilizable (el mismo que usa el test para importar).
  fs.writeFileSync(
    IMPORT_CSV,
    [
      'nombre,sku,categoria,unidad,stock_inicial,costo,precio_venta',
      'Pan Canilla Integral,PN-1001,Panadería,uds,12,0.35,0.5',
      'Queso Blanco 500g,QS-1002,Abasto,kg,8,1.9,2.6',
      'Huevos (cartón x30),HV-1003,Abasto,uds,20,2.1,2.8',
      'Cebolla 1kg,CB-1004,Verduras,kg,15,0.45,0.7',
      'Tomate 1kg,TM-1005,Verduras,kg,18,0.5,0.8',
      'Frijol Negro 1kg,FJ-1006,Abasto,kg,10,1.15,1.7',
    ].join('\n'),
    'utf8',
  );
});

test.afterAll(async () => {
  if (handle) await handle.close();
  console.log(`Artefactos guardados en: ${RUN_DIR}`);
});

test('exportar movimientos a CSV: archivo en el escritorio y contenido ordenado', async () => {
  await freshNav(handle.win, '/inventory');
  await handle.win.screenshot({ path: path.join(SHOT_DIR, 'cap-03-movimientos.png'), fullPage: true });

  const since = Date.now();
  await handle.win.getByRole('button', { name: 'Exportar CSV' }).click();

  const file = await waitForDownloadSince(EXPORT_DIR, since, 10_000, '.csv');
  const content = fs.readFileSync(file, 'utf8');

  expect(file).toContain(EXPORT_DIR);
  expect(content.startsWith('\ufeff')).toBe(true);
  expect(content.replace(/^\ufeff/, '').split('\n')[0]).toBe('"Fecha","Tipo","Producto","SKU","Almacén","Cantidad","Stock resultante","Nota","Usuario"');
  expect(content).toContain('"Entrada"');
  expect(content).toContain('"Salida"');
  expect(content).toContain('Harina PAN');
  expect(content).toContain('HP-2748');
  expect(content).toContain('Lote inicial de abastecimiento');
  expect(content).toContain('Venta mostrador');
});

test('exportar movimientos a PDF: archivo en el escritorio', async () => {
  await freshNav(handle.win, '/inventory');
  const since = Date.now();
  await handle.win.getByRole('button', { name: 'Exportar PDF' }).click();

  const file = await waitForDownloadSince(EXPORT_DIR, since, 10_000, '.pdf');
  const head = fs.readFileSync(file).subarray(0, 5).toString('latin1');
  expect(head).toBe('%PDF-');
  expect(fs.statSync(file).size).toBeGreaterThan(1000);
});

test('exportar reporte de inventario a CSV: archivo en el escritorio y contenido ordenado', async () => {
  await freshNav(handle.win, '/reports');
  await handle.win.screenshot({ path: path.join(SHOT_DIR, 'cap-04-reporte-inventario.png'), fullPage: true });

  const since = Date.now();
  await handle.win.getByRole('button', { name: 'Exportar CSV' }).click();

  const file = await waitForDownloadSince(EXPORT_DIR, since, 10_000, '.csv');
  const content = fs.readFileSync(file, 'utf8');

  expect(file).toContain(EXPORT_DIR);
  expect(content.startsWith('\ufeff')).toBe(true);
  expect(content.replace(/^\ufeff/, '').split('\n')[0]).toBe('"Producto","SKU","Categoría","Unidad","Stock","Costo unit.","Valor"');
  expect(content).toContain('Harina PAN');
  expect(content).toContain('HP-2748');
  expect(content).not.toMatch(/[.,]\d{3}/);
});

test('exportar reporte de inventario a PDF: archivo en el escritorio', async () => {
  await freshNav(handle.win, '/reports');
  const since = Date.now();
  await handle.win.getByRole('button', { name: 'Exportar PDF' }).click();

  const file = await waitForDownloadSince(EXPORT_DIR, since, 10_000, '.pdf');
  const head = fs.readFileSync(file).subarray(0, 5).toString('latin1');
  expect(head).toBe('%PDF-');
  expect(fs.statSync(file).size).toBeGreaterThan(1000);
});

test('importar CSV: muestra el resultado y los productos quedan visibles en la app', async () => {
  await stubOpenDialog(IMPORT_CSV);

  await freshNav(handle.win, '/products');
  await handle.win.getByRole('button', { name: 'Importar' }).click();

  const resultModal = handle.win.locator('.fixed.inset-0').last();
  await expect(resultModal.locator('h2', { hasText: 'Resultado de importación' })).toBeVisible({ timeout: 20_000 });
  await expect(resultModal.getByText('Se importaron 6 productos')).toBeVisible();
  await expect(resultModal.getByText('Omitidos: 0')).toBeVisible();
  await handle.win.screenshot({ path: path.join(SHOT_DIR, 'cap-01-import-resultado.png'), fullPage: true });

  await resultModal.getByText('Cerrar', { exact: true }).click();

  await freshNav(handle.win, '/products');
  await expect(handle.win.getByText('Pan Canilla Integral')).toBeVisible({ timeout: 10_000 });
  await expect(handle.win.getByText('Frijol Negro 1kg')).toBeVisible();
  await handle.win.screenshot({ path: path.join(SHOT_DIR, 'cap-02-productos-tras-importar.png'), fullPage: true });

  const products = (await listProducts(handle.win)).data as Array<{ name: string; sku: string }>;
  const imported = products.filter((p) => p.sku.startsWith('PN-') || p.sku.startsWith('FJ-'));
  expect(imported).toHaveLength(2);

  const movements = (await listMovements(handle.win)).data as unknown[];
  expect(movements.length).toBeGreaterThanOrEqual(9);
});