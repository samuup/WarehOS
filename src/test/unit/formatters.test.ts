import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber } from '../../renderer/lib/formatters';

describe('formatCurrency', () => {
  it('formatea un monto en bolívares (default)', () => {
    expect(formatCurrency(1234.5)).toContain('1.234,50');
    expect(formatCurrency(1234.5)).toContain('Bs.');
    expect(formatCurrency(1234.5)).not.toContain('Bs.S');
  });

  it('formatea cero correctamente', () => {
    expect(formatCurrency(0)).toContain('0,00');
  });

  it('usa la moneda configurada (USD)', () => {
    expect(formatCurrency(99.9, 'USD')).toContain('99.90');
    expect(formatCurrency(99.9, 'USD')).toContain('$');
  });

  it('usa la moneda configurada (EUR)', () => {
    expect(formatCurrency(123, 'EUR')).toContain('€');
  });

  it('cae a VES ante una moneda desconocida', () => {
    expect(formatCurrency(10, 'XXX')).toMatch(/10,?\.?00/);
  });
});

describe('formatNumber', () => {
  it('formatea número con separadores de miles del locale por defecto', () => {
    expect(formatNumber(1000000)).toBe('1.000.000');
  });

  it('formatea decimales', () => {
    expect(formatNumber(42.5)).toBe('42,5');
  });

  it('respeta el locale de la moneda al formatear números', () => {
    expect(formatNumber(1000000, 'EUR')).toBe('1.000.000');
  });
});