import { describe, it, expect } from 'vitest';
import { mapImportRow } from '../../shared/importParser';

describe('mapImportRow', () => {
  it('mapea una fila con encabezados en español', () => {
    const row = mapImportRow({
      nombre: '  Manzana  ',
      sku: 'MAN-001',
      categoria: 'Frutas',
      unidad: 'kg',
      stock_inicial: 25,
      costo: 3.5,
      precio_venta: 6.9,
    });
    expect(row).toEqual({
      nombre: 'Manzana',
      sku: 'MAN-001',
      barcode: '',
      descripcion: '',
      categoria: 'Frutas',
      unidad: 'kg',
      stock_min: undefined,
      stock_inicial: 25,
      costo: 3.5,
      precio_venta: 6.9,
    });
  });

  it('acepta encabezados en inglés', () => {
    const row = mapImportRow({
      name: 'Laptop',
      sku: 'LT-01',
      category: 'Tecnología',
      unit: 'uds',
      cost: 1500,
      sale_price: 2200,
      stock: 4,
    });
    expect(row?.nombre).toBe('Laptop');
    expect(row?.categoria).toBe('Tecnología');
    expect(row?.costo).toBe(1500);
    expect(row?.precio_venta).toBe(2200);
    expect(row?.stock_inicial).toBe(4);
  });

  it('normaliza números pasados como string', () => {
    const row = mapImportRow({
      nombre: 'Camisa',
      sku: 'CAM-1',
      costo: '25.50',
      stock_inicial: '10',
    });
    expect(row?.costo).toBe(25.5);
    expect(row?.stock_inicial).toBe(10);
  });

  it('ignora filas sin nombre/producto', () => {
    expect(mapImportRow({ sku: 'X-1', categoria: 'Y' })).toBeNull();
    expect(mapImportRow({})).toBeNull();
  });

  it('deja valores numéricos inválidos como undefined', () => {
    const row = mapImportRow({ nombre: 'A', sku: 'A-1', costo: 'abc' });
    expect(row?.costo).toBeUndefined();
  });

  it('mapea el código de barras con distintos encabezados', () => {
    const es = mapImportRow({ nombre: 'Arroz', sku: 'AR-1', codigo_barras: '7501000112345' });
    const en = mapImportRow({ nombre: 'Rice', sku: 'RI-1', barcode: '7750291001123' });
    const alias = mapImportRow({ nombre: 'Fideo', sku: 'FI-1', codigobarras: 'abc-123' });
    expect(es?.barcode).toBe('7501000112345');
    expect(en?.barcode).toBe('7750291001123');
    expect(alias?.barcode).toBe('abc-123');
  });

  it('deja el barcode como string vacío si no viene', () => {
    const row = mapImportRow({ nombre: 'Agua', sku: 'AG-1' });
    expect(row?.barcode).toBe('');
  });

  it('parsa números con coma decimal (Europa/América Latina)', () => {
    const row = mapImportRow({
      nombre: 'Arroz',
      sku: 'AR-1',
      costo: '1,50',
      precio_venta: '0,75',
      stock_inicial: '10,5',
    });
    expect(row?.costo).toBe(1.5);
    expect(row?.precio_venta).toBe(0.75);
    expect(row?.stock_inicial).toBe(10.5);
  });

  it('parsa números con punto de miles y coma decimal', () => {
    const row = mapImportRow({ nombre: 'TV', sku: 'TV-1', costo: '1.234,56' });
    expect(row?.costo).toBe(1234.56);
  });

  it('parsa números con coma de miles y punto decimal', () => {
    const row = mapImportRow({ nombre: 'TV', sku: 'TV-1', costo: '1,234.56' });
    expect(row?.costo).toBe(1234.56);
  });

  it('trata un separador con 3 dígitos finales como miles', () => {
    expect(mapImportRow({ nombre: 'A', sku: 'A', costo: '1.234' })?.costo).toBe(1234);
    expect(mapImportRow({ nombre: 'A', sku: 'A', costo: '1,234' })?.costo).toBe(1234);
  });

  it('mantiene números inválidos como undefined', () => {
    expect(mapImportRow({ nombre: 'A', sku: 'A', costo: '1.2.3' })?.costo).toBeUndefined();
  });

  it('acepta encabezados con espacios y acentos (hojas reales)', () => {
    const row = mapImportRow({
      '  Nombre  ': 'Fideo',
      'SKU': 'FI-1',
      'Precio de Venta': '2,50',
      'Código de barras': '7501',
      'Stock Inicial': '8',
    });
    expect(row?.nombre).toBe('Fideo');
    expect(row?.precio_venta).toBe(2.5);
    expect(row?.barcode).toBe('7501');
    expect(row?.stock_inicial).toBe(8);
  });

  it('acepta sinónimos comunes de encabezados', () => {
    const row = mapImportRow({ producto: 'Leche', referencia: 'LE-1', rubro: 'Lácteos', um: 'l', existencias: '3', costo_unitario: '1.2' });
    expect(row?.nombre).toBe('Leche');
    expect(row?.sku).toBe('LE-1');
    expect(row?.categoria).toBe('Lácteos');
    expect(row?.unidad).toBe('l');
    expect(row?.stock_inicial).toBe(3);
    expect(row?.costo).toBe(1.2);
  });
});
