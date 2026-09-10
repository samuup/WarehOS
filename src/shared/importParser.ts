import type { ImportRow } from './types';

const toNum = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  const s = String(v).trim().replace(/\s/g, '')
  if (s === '') return undefined

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const hasComma = lastComma >= 0
  const hasDot = lastDot >= 0

  let normalized: string
  if (hasComma && hasDot) {
    normalized = lastComma > lastDot
      ? s.replace(/\./g, '').replace(/,/g, '.')
      : s.replace(/,/g, '')
  } else if (hasComma) {
    normalized = s.length - lastComma - 1 === 3 ? s.replace(/,/g, '') : s.replace(/,/g, '.')
  } else if (hasDot) {
    normalized = s.length - lastDot - 1 === 3 ? s.replace(/\./g, '') : s
  } else {
    normalized = s
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? n : undefined
}

const pick = (obj: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
};

const keyOf = (k: string): string => k.trim().toLowerCase().replace(/\s+/g, '_')

export function mapImportRow(obj: Record<string, unknown>): ImportRow | null {
  const norm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    norm[keyOf(k)] = v;
  }

  const name = pick(norm, ['nombre', 'name', 'producto', 'product', 'articulo', 'artículo', 'item', 'descripcion_producto', 'description_product']);
  if (name == null || String(name).trim() === '') return null;

  return {
    nombre: String(name).trim(),
    sku: String(pick(norm, ['sku', 'codigo', 'code', 'referencia', 'referencia_interna', 'product_id']) ?? '').trim(),
    barcode: String(pick(norm, ['barcode', 'codigo_barras', 'codigobarras', 'código_barras', 'codigo_de_barras', 'código_de_barras', 'ean', 'ean_13', 'gtin', 'codebar']) ?? '').trim(),
    descripcion: String(pick(norm, ['descripcion', 'description', 'descripción', 'detalle', 'notas']) ?? '').trim(),
    categoria: String(pick(norm, ['categoria', 'category', 'categoría', 'rubro', 'tipo']) ?? '').trim(),
    unidad: String(pick(norm, ['unidad', 'unit', 'unidades', 'medida', 'um']) ?? '').trim(),
    stock_min: toNum(pick(norm, ['stock_min', 'stockminimo', 'stock_mínimo', 'stock_minimo', 'stock_minimum', 'minimo'])),
    stock_inicial: toNum(
      pick(norm, ['stock_inicial', 'stockinicial', 'stock', 'current_stock', 'existencia', 'existencias', 'cantidad_inicial']),
    ),
    costo: toNum(pick(norm, ['costo', 'cost', 'cost_price', 'costounitario', 'costo_unitario', 'precio_costo', 'precio_de_costo', 'cost_price_unit'])),
    precio_venta: toNum(
      pick(norm, ['precio_venta', 'price', 'sale_price', 'precio', 'precio_de_venta', 'precio_unitario']),
    ),
  };
}