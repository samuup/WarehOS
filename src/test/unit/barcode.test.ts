import { describe, it, expect } from 'vitest';
import { normalizeBarcode } from '../../shared/barcode';

describe('normalizeBarcode', () => {
  it('recorta y convierte a mayúsculas', () => {
    expect(normalizeBarcode('  abc-123  ')).toBe('ABC-123');
  });

  it('deja EAN-13 numérico intacto', () => {
    expect(normalizeBarcode('7501000112345')).toBe('7501000112345');
  });

  it('convierte null y undefined en null', () => {
    expect(normalizeBarcode(null)).toBeNull();
    expect(normalizeBarcode(undefined)).toBeNull();
  });

  it('convierte string vacío o solo espacios en null', () => {
    expect(normalizeBarcode('')).toBeNull();
    expect(normalizeBarcode('   ')).toBeNull();
  });
});