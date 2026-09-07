import type { ImportRow } from './types';

const toNum = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const pick = (obj: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
};

export function mapImportRow(obj: Record<string, unknown>): ImportRow | null {
  const norm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    norm[k.toString().trim().toLowerCase()] = v;
  }

  const name = pick(norm, ['nombre', 'name', 'producto']);
  if (name == null || String(name).trim() === '') return null;

  return {
    nombre: String(name).trim(),
    sku: String(pick(norm, ['sku']) ?? '').trim(),
    barcode: String(pick(norm, ['barcode', 'codigo_barras', 'codigobarras', 'código_barras']) ?? '').trim(),
    descripcion: String(pick(norm, ['descripcion', 'description']) ?? '').trim(),
    categoria: String(pick(norm, ['categoria', 'category', 'categoría']) ?? '').trim(),
    unidad: String(pick(norm, ['unidad', 'unit', 'unidades']) ?? '').trim(),
    stock_min: toNum(pick(norm, ['stock_min', 'stockminimo', 'stock_mínimo'])),
    stock_inicial: toNum(
      pick(norm, ['stock_inicial', 'stock', 'current_stock', 'stockinicial']),
    ),
    costo: toNum(pick(norm, ['costo', 'cost', 'cost_price', 'costounitario'])),
    precio_venta: toNum(
      pick(norm, ['precio_venta', 'price', 'sale_price', 'precio']),
    ),
  };
}
