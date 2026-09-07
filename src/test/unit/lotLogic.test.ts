import { describe, it, expect } from 'vitest';
import { fefoAllocate, redistributeLots, sortFefo, lotListTotal } from '@shared/lotLogic';
import type { Lot } from '@shared/types';

function lot(partial: Partial<Lot>): Lot {
  return {
    id: 0,
    product_id: 1,
    warehouse_id: 1,
    batch: '',
    expiry_date: null,
    quantity: 0,
    created_at: '',
    ...partial,
  };
}

describe('sortFefo', () => {
  it('ordena por vencimiento ascendente dejando los sin fecha al final', () => {
    const lots = [
      lot({ id: 1, batch: 'L2', expiry_date: '2027-02-01', quantity: 5 }),
      lot({ id: 2, batch: 'L1', expiry_date: '2026-12-01', quantity: 5 }),
      lot({ id: 3, batch: 'L3', expiry_date: null, quantity: 5 }),
    ];
    expect(sortFefo(lots).map((l) => l.id)).toEqual([2, 1, 3]);
  });
});

describe('fefoAllocate', () => {
  it('descuesta primero el lote que vence antes', () => {
    const lots = [
      lot({ id: 1, batch: 'L1', expiry_date: '2026-12-01', quantity: 4 }),
      lot({ id: 2, batch: 'L2', expiry_date: '2027-06-01', quantity: 10 }),
    ];
    const res = fefoAllocate(lots, 6);
    expect(res.ok).toBe(true);
    expect(res.allocations).toEqual([
      { lot: lots[0], qty: 4 },
      { lot: lots[1], qty: 2 },
    ]);
  });

  it('consume los lotes sin vencimiento al final', () => {
    const lots = [
      lot({ id: 1, batch: 'SIN-FECHA', expiry_date: null, quantity: 10 }),
      lot({ id: 2, batch: 'L1', expiry_date: '2026-12-01', quantity: 3 }),
    ];
    const res = fefoAllocate(lots, 5);
    expect(res.ok).toBe(true);
    expect(res.allocations).toEqual([
      { lot: lots[1], qty: 3 },
      { lot: lots[0], qty: 2 },
    ]);
  });

  it('rechaza cantidad mayor al total de los lotes', () => {
    const lots = [lot({ batch: 'L1', expiry_date: '2026-12-01', quantity: 3 })];
    const res = fefoAllocate(lots, 4);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Stock insuficiente');
  });

  it('rechaza cantidades no positivas', () => {
    const res = fefoAllocate([], 0);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('mayor a 0');
  });
});

describe('redistributeLots', () => {
  it('devuelve los lotes intactos si el total no cambia', () => {
    const lots = [
      lot({ id: 1, batch: 'L1', expiry_date: '2026-12-01', quantity: 4 }),
      lot({ id: 2, batch: 'L2', expiry_date: '2027-06-01', quantity: 10 }),
    ];
    const res = redistributeLots(lots, 14);
    expect(res.ok).toBe(true);
    expect(lotListTotal(res.newLots)).toBe(14);
    expect(res.newLots.map((l) => l.quantity).sort((a, b) => a - b)).toEqual([4, 10]);
  });

  it('al subir suma el excedente al lote que vence más tarde', () => {
    const lots = [
      lot({ id: 1, batch: 'L1', expiry_date: '2026-12-01', quantity: 4 }),
      lot({ id: 2, batch: 'L2', expiry_date: '2027-06-01', quantity: 10 }),
    ];
    const res = redistributeLots(lots, 20);
    expect(res.ok).toBe(true);
    expect(lotListTotal(res.newLots)).toBe(20);
    expect(res.newLots.find((l) => l.batch === 'L1')?.quantity).toBe(4);
    expect(res.newLots.find((l) => l.batch === 'L2')?.quantity).toBe(16);
  });

  it('al bajar reduce desde el lote que vence más tarde y descarta vacíos', () => {
    const lots = [
      lot({ id: 1, batch: 'L1', expiry_date: '2026-12-01', quantity: 4 }),
      lot({ id: 2, batch: 'L2', expiry_date: '2027-06-01', quantity: 10 }),
    ];
    const res = redistributeLots(lots, 3);
    expect(res.ok).toBe(true);
    expect(res.newLots).toHaveLength(1);
    expect(res.newLots[0].batch).toBe('L1');
    expect(res.newLots[0].quantity).toBe(3);
  });

  it('rechaza totales negativos', () => {
    const res = redistributeLots([], -1);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('negativa');
  });

  it('con total positivo y sin lotes informa de usar una entrada', () => {
    const res = redistributeLots([], 5);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('entrada con lote');
  });
});