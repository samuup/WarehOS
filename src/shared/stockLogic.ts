import type { MovementType } from './types';

export interface StockCalcResult {
  newStock: number;
  error?: string;
}

export function calculateNewStock(
  type: MovementType,
  quantity: number,
  currentStock: number,
): StockCalcResult {
  if (type === 'ADJUSTMENT') {
    if (quantity < 0) {
      return { newStock: currentStock, error: 'La cantidad no puede ser negativa' };
    }
    return { newStock: quantity };
  }

  if (quantity <= 0) {
    return { newStock: currentStock, error: 'La cantidad debe ser mayor a 0' };
  }

  if (type === 'IN') {
    return { newStock: currentStock + quantity };
  }

  if (type === 'OUT' || type === 'TRANSFER') {
    if (quantity > currentStock) {
      return {
        newStock: currentStock,
        error: `Stock insuficiente. Stock actual: ${currentStock}`,
      };
    }
    return { newStock: currentStock - quantity };
  }

  return { newStock: currentStock, error: 'Tipo de movimiento no válido' };
}
