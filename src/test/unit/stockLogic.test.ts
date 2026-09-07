import { describe, it, expect } from 'vitest';
import { calculateNewStock } from '../../shared/stockLogic';

describe('calculateNewStock', () => {
  it('incrementa el stock en una entrada (IN)', () => {
    const result = calculateNewStock('IN', 10, 5);
    expect(result.error).toBeUndefined();
    expect(result.newStock).toBe(15);
  });

  it('decrementa el stock en una salida (OUT)', () => {
    const result = calculateNewStock('OUT', 3, 10);
    expect(result.error).toBeUndefined();
    expect(result.newStock).toBe(7);
  });

  it('rechaza una salida con stock insuficiente', () => {
    const result = calculateNewStock('OUT', 20, 10);
    expect(result.error).toContain('Stock insuficiente');
    expect(result.newStock).toBe(10);
  });

  it('un ajuste (ADJUSTMENT) fija el stock al valor dado', () => {
    const result = calculateNewStock('ADJUSTMENT', 42, 10);
    expect(result.error).toBeUndefined();
    expect(result.newStock).toBe(42);
  });

  it('rechaza una cantidad menor o igual a 0 en entradas y salidas', () => {
    for (const type of ['IN', 'OUT', 'TRANSFER'] as const) {
      const result = calculateNewStock(type, 0, 5);
      expect(result.error).toContain('mayor a 0');
    }
  });

  it('una transferencia (TRANSFER) resta al almacén de origen', () => {
    const result = calculateNewStock('TRANSFER', 3, 10);
    expect(result.error).toBeUndefined();
    expect(result.newStock).toBe(7);
  });

  it('rechaza una transferencia con stock insuficiente en el origen', () => {
    const result = calculateNewStock('TRANSFER', 20, 10);
    expect(result.error).toContain('Stock insuficiente');
    expect(result.newStock).toBe(10);
  });

  it('rechaza un ajuste con cantidad negativa', () => {
    const result = calculateNewStock('ADJUSTMENT', -3, 5);
    expect(result.error).toBe('La cantidad no puede ser negativa');
  });

  it('permite ajustar el stock a cero', () => {
    const result = calculateNewStock('ADJUSTMENT', 0, 5);
    expect(result.error).toBeUndefined();
    expect(result.newStock).toBe(0);
  });
});