import type { Lot } from './types';

function compareExpiry(a: { expiry_date: string | null }, b: { expiry_date: string | null }): number {
  if (a.expiry_date === b.expiry_date) return 0;
  if (a.expiry_date === null) return 1;
  if (b.expiry_date === null) return -1;
  return a.expiry_date < b.expiry_date ? -1 : 1;
}

export function sortFefo(lots: Lot[]): Lot[] {
  return [...lots].sort(compareExpiry);
}

export interface FefoAllocation {
  lot: Lot;
  qty: number;
}

export interface FefoResult {
  ok: boolean;
  error?: string;
  allocations: FefoAllocation[];
}

/**
 * Reparte `qty` entre los lotes, consumiendo primero el que vence antes (FEFO).
 * Los lotes sin fecha de vencimiento se consumen al final.
 */
export function fefoAllocate(lots: Lot[], qty: number): FefoResult {
  if (qty <= 0) {
    return { ok: false, error: 'La cantidad debe ser mayor a 0', allocations: [] };
  }
  const sorted = sortFefo(lots);
  const total = sorted.reduce((s, l) => s + l.quantity, 0);
  if (qty > total) {
    return {
      ok: false,
      error: `Stock insuficiente. Stock en lotes: ${total}`,
      allocations: [],
    };
  }
  const allocations: FefoAllocation[] = [];
  let remaining = qty;
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    if (take > 0) allocations.push({ lot, qty: take });
    remaining -= take;
  }
  return { ok: true, allocations };
}

export function lotListTotal(lots: Lot[]): number {
  return lots.reduce((s, l) => s + l.quantity, 0);
}

export interface RedistributeResult {
  ok: boolean;
  error?: string;
  newLots: Lot[];
}

/**
 * Reasigna el stock total de un producto entre sus lotes (para ADJUSTMENT).
 * - Si sube: el excedente se suma al lote que vence más tarde (preserva el que vence primero).
 * - Si baja: se reduce desde el lote que vence más tarde (preserva el que vence primero).
 * - Los lotes vacíos se descartan.
 */
export function redistributeLots(lots: Lot[], newTotal: number): RedistributeResult {
  if (newTotal < 0) {
    return { ok: false, error: 'La cantidad no puede ser negativa', newLots: lots };
  }
  const sorted = sortFefo(lots);
  const total = lotListTotal(sorted);

  if (newTotal === total) return { ok: true, newLots: sorted };

  if (newTotal > total) {
    if (sorted.length === 0) {
      return {
        ok: false,
        error: 'No hay lotes para reasignar. Usa una entrada con lote para agregar stock.',
        newLots: sorted,
      };
    }
    const newLots = sorted.map((l) => ({ ...l }));
    newLots[newLots.length - 1].quantity += newTotal - total;
    return { ok: true, newLots };
  }

  const newLots = sorted.map((l) => ({ ...l }));
  let toRemove = total - newTotal;
  for (let i = newLots.length - 1; i >= 0 && toRemove > 0; i--) {
    const take = Math.min(newLots[i].quantity, toRemove);
    newLots[i].quantity -= take;
    toRemove -= take;
  }
  return { ok: true, newLots: newLots.filter((l) => l.quantity > 0) };
}