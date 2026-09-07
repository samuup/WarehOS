export interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  current_stock: number;
  stock_min: number;
}

export function findLowStock(
  products: Pick<LowStockProduct, 'id' | 'name' | 'sku' | 'current_stock' | 'stock_min'>[],
): LowStockProduct[] {
  return products
    .filter((p) => p.stock_min > 0 && p.current_stock <= p.stock_min)
    .sort((a, b) => a.current_stock / a.stock_min - b.current_stock / b.stock_min);
}

export function buildLowStockMessage(low: LowStockProduct[]): string {
  if (low.length === 0) return 'No hay productos bajo el mínimo.';
  const max = 3;
  const shown = low.slice(0, max);
  const parts = shown.map((p) => `${p.name}: ${p.current_stock}/${p.stock_min}`);
  if (low.length > max) parts.push(`y ${low.length - max} más...`);
  return parts.join(' · ');
}