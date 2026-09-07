import { describe, it, expect } from 'vitest';
import { buildExpiryMessage } from '../../shared/expiryLogic';

const notes = [
  { productName: 'Yogur', sku: 'Y1', batch: 'L-001', expiryDate: '2026-09-10', daysLeft: 2, status: 'near' as const },
  { productName: 'Leche', sku: 'Y2', batch: 'L-002', expiryDate: '2026-09-05', daysLeft: -3, status: 'expired' as const },
  { productName: 'Queso', sku: 'Y3', batch: 'L-003', expiryDate: '2026-09-15', daysLeft: 7, status: 'near' as const },
];

describe('buildExpiryMessage', () => {
  it('devuelve mensaje vacío sin lotes', () => {
    expect(buildExpiryMessage([])).toBe('No hay lotes por vencer.');
  });

  it('resume los lotes detectados indicando días y vencidos', () => {
    const msg = buildExpiryMessage(notes);
    expect(msg).toContain('Yogur (L-001): 2d');
    expect(msg).toContain('Leche (L-002): vencido');
    expect(msg).toContain('Queso (L-003): 7d');
  });

  it('corta la lista después de 3 y resume el resto', () => {
    const five = [
      { productName: 'A', sku: '1', batch: 'L-A', expiryDate: '2026-09-10', daysLeft: 1, status: 'near' as const },
      { productName: 'B', sku: '2', batch: 'L-B', expiryDate: '2026-09-10', daysLeft: 1, status: 'near' as const },
      { productName: 'C', sku: '3', batch: 'L-C', expiryDate: '2026-09-10', daysLeft: 1, status: 'near' as const },
      { productName: 'D', sku: '4', batch: 'L-D', expiryDate: '2026-09-10', daysLeft: 1, status: 'near' as const },
      { productName: 'E', sku: '5', batch: 'L-E', expiryDate: '2026-09-10', daysLeft: 1, status: 'near' as const },
    ];
    const msg = buildExpiryMessage(five);
    expect(msg).toContain('C (L-C): 1d');
    expect(msg).not.toContain('D (L-D)');
    expect(msg).toContain('y 2 más...');
  });
});