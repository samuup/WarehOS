import { describe, it, expect } from 'vitest';
import { computeStockTrend, labelDate } from '../../shared/chartLogic';
import type { TrendRow } from '../../shared/chartLogic';

function row(partial: Partial<TrendRow>): TrendRow {
  return {
    type: 'IN',
    quantity: 10,
    new_stock: 10,
    warehouse_id: 1,
    destination_warehouse_id: null,
    created_at: '2026-09-01 10:00:00',
    ...partial,
  };
}

describe('computeStockTrend', () => {
  it('está vacía cuando no hay movimientos (todos en 0)', () => {
    const points = computeStockTrend([], 30);
    expect(points).toHaveLength(30);
    expect(points.every((p) => p.total === 0)).toBe(true);
  });

  it('refleja el stock acumulado por entradas en días sucesivos', () => {
    const points = computeStockTrend([row({ created_at: '2026-08-20 10:00:00' })], 7);
    const last = points[points.length - 1];
    expect(last.total).toBe(10);
    expect(points[0].date).toBeTruthy();
    // la tendencia llega hasta hoy
    const today = new Date();
    expect(last.date).toBe(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`,
    );
  });

  it('descuenta salidas (OUT) y respeta ajustes', () => {
    const history = [
      row({ created_at: '2026-08-01 10:00:00', new_stock: 100 }),
      row({ type: 'OUT', quantity: 30, new_stock: 70, created_at: '2026-08-10 10:00:00' }),
      row({ type: 'ADJUSTMENT', quantity: 50, new_stock: 50, created_at: '2026-08-20 10:00:00' }),
    ];
    const points = computeStockTrend(history, 5);
    expect(points[points.length - 1].total).toBe(50);
  });

  it('suma correctamente transferencias entre almacenes (no cambia el total)', () => {
    const history = [
      row({ created_at: '2026-08-01 10:00:00', new_stock: 40 }),
      row({
        type: 'TRANSFER',
        quantity: 15,
        new_stock: 25,
        warehouse_id: 1,
        destination_warehouse_id: 2,
        created_at: '2026-08-10 10:00:00',
      }),
    ];
    // origen quedó en 25, destino pasó de 0 a 15 → total 40
    const points = computeStockTrend(history, 5);
    expect(points[points.length - 1].total).toBe(40);
  });

  it('mantiene el total de días sin movimientos', () => {
    const history = [row({ created_at: '2026-08-05 10:00:00' })];
    const points = computeStockTrend(history, 10);
    const totals = points.map((p) => p.total);
    expect(totals.every((t) => t === 10)).toBe(true);
  });

  it('trata movimientos legacy (almacén NULL) como un bucket global', () => {
    const history = [row({ warehouse_id: null, new_stock: 33 })];
    const points = computeStockTrend(history, 5);
    expect(points[points.length - 1].total).toBe(33);
  });
});

describe('labelDate', () => {
  it('formatea fechas AAAA-MM-DD a formato corto', () => {
    expect(labelDate('2026-09-04')).toMatch(/04/);
  });
});