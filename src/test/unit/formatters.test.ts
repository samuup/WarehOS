import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber } from '../../renderer/lib/formatters';

describe('formatCurrency', () => {
  it('formatea un monto en soles', () => {
    expect(formatCurrency(1234.5)).toContain('1,234.50');
  });

  it('formatea cero correctamente', () => {
    expect(formatCurrency(0)).toContain('0.00');
  });

  it('usa la moneda configurada (USD)', () => {
    expect(formatCurrency(99.9, 'USD')).toContain('99.90');
    expect(formatCurrency(99.9, 'USD')).toContain('$');
  });

  it('usa la moneda configurada (EUR)', () => {
    expect(formatCurrency(123, 'EUR')).toContain('€');
  });

  it('cae a PEN ante una moneda desconocida', () => {
    expect(formatCurrency(10, 'XXX')).toMatch(/10,?\.?00/);
  });

  it('formatea monedas internacionales añadidas', () => {
    expect(formatCurrency(12.5, 'BRL')).toContain('12,50');
    expect(formatCurrency(12.5, 'BRL')).toContain('R$');
    expect(formatCurrency(1000, 'JPY')).toContain('1,000');
    expect(formatCurrency(12.34, 'GBP')).toContain('£');
    expect(formatCurrency(12.34, 'CAD')).toContain('12.34');
  });
});

describe('formatNumber', () => {
  it('formatea número con separadores de miles', () => {
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('formatea decimales', () => {
    expect(formatNumber(42.5)).toBe('42.5');
  });

  it('respeta el locale de la moneda al formatear números', () => {
    expect(formatNumber(1000000, 'BRL')).toBe('1.000.000');
  });
});