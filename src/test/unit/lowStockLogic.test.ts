import { describe, it, expect } from 'vitest';
import { findLowStock, buildLowStockMessage } from '../../shared/lowStockLogic';

const products = [
  { id: 1, name: 'Arroz', sku: 'A1', current_stock: 10, stock_min: 20 },
  { id: 2, name: 'Aceite', sku: 'A2', current_stock: 40, stock_min: 40 },
  { id: 3, name: 'Fideos', sku: 'A3', current_stock: 30, stock_min: 0 },
  { id: 4, name: 'Atún', sku: 'A4', current_stock: 5, stock_min: 50 },
];

describe('findLowStock', () => {
  it('detecta productos en su mínimo', () => {
    const low = findLowStock(products);
    expect(low.map((p) => p.id)).toEqual([4, 1, 2]);
  });

  it('ignora productos sin stock mínimo configurado', () => {
    const low = findLowStock(products);
    expect(low.some((p) => p.id === 3)).toBe(false);
  });

  it('ordena por gravedad (proporción más baja primero)', () => {
    const low = findLowStock(products);
    expect(low[0].id).toBe(4);
  });

  it('no reporta nada cuando no hay bajo stock', () => {
    expect(findLowStock([{ id: 1, name: 'X', sku: 'X', current_stock: 100, stock_min: 5 }])).toEqual([]);
  });
});

describe('buildLowStockMessage', () => {
  it('devuelve mensaje vacío sin productos', () => {
    expect(buildLowStockMessage([])).toBe('No hay productos bajo el mínimo.');
  });

  it('resume los productos detectados', () => {
    const low = findLowStock(products);
    const msg = buildLowStockMessage(low);
    expect(msg).toContain('Atún: 5/50');
    expect(msg).toContain('Arroz: 10/20');
    expect(msg).toContain('Aceite: 40/40');
  });

  it('corta la lista después de 3 y resume el resto', () => {
    const five = [
      { id: 1, name: 'A', sku: '1', current_stock: 1, stock_min: 10 },
      { id: 2, name: 'B', sku: '2', current_stock: 1, stock_min: 10 },
      { id: 3, name: 'C', sku: '3', current_stock: 1, stock_min: 10 },
      { id: 4, name: 'D', sku: '4', current_stock: 1, stock_min: 10 },
      { id: 5, name: 'E', sku: '5', current_stock: 1, stock_min: 10 },
    ];
    const msg = buildLowStockMessage(findLowStock(five));
    expect(msg).toContain('C: 1/10');
    expect(msg).not.toContain('D: 1/10');
    expect(msg).toContain('y 2 más...');
  });
});