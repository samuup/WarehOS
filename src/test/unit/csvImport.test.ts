import { describe, it, expect } from 'vitest';
import { parseCsvBuffer } from '../../shared/csvImport';

const buf = (s: string): Buffer => Buffer.from(s, 'utf8');

describe('parseCsvBuffer', () => {
  it('parsa CSV con coma y puntos decimales', () => {
    const { rows } = parseCsvBuffer(buf('nombre,sku,costo\nPan,PN1,1.5'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ nombre: 'Pan', sku: 'PN1', costo: '1.5' });
  });

  it('detecta CSV con punto y coma (Excel español)', () => {
    const { rows } = parseCsvBuffer(buf('nombre;sku;costo\nPan;PN1;1,50'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ nombre: 'Pan', sku: 'PN1', costo: '1,50' });
  });

  it('detecta CSV separado por tabs', () => {
    const { rows } = parseCsvBuffer(buf('nombre\tsku\tcosto\nPan\tPN1\t2.25'));
    expect(rows[0]).toEqual({ nombre: 'Pan', sku: 'PN1', costo: '2.25' });
  });

  it('ignora un BOM UTF-8 inicial', () => {
    const { rows } = parseCsvBuffer(buf('\uFEFFnombre,sku\nPan,PN1'));
    expect(rows[0]).toEqual({ nombre: 'Pan', sku: 'PN1' });
  });

  it('decodifica UTF-16 LE con BOM', () => {
    const b = Buffer.from('nombre,sku\nPan,PN1', 'utf16le');
    const withBom = Buffer.concat([Buffer.from([0xff, 0xfe]), b]);
    const { rows } = parseCsvBuffer(withBom);
    expect(rows[0]).toEqual({ nombre: 'Pan', sku: 'PN1' });
  });

  it('decodifica Latin-1/ISO-8859-1', () => {
    const b = Buffer.concat([
      Buffer.from('nombre,sku,descripcion\n', 'latin1'),
      Buffer.from('Pa\xf1,PN1,Caf\xe9', 'latin1'),
    ]);
    const { rows } = parseCsvBuffer(b);
    expect(rows[0]).toEqual({ nombre: 'Pañ', sku: 'PN1', descripcion: 'Café' });
  });

  it('respeta comillas: comas internas y saltos de línea', () => {
    const { rows } = parseCsvBuffer(
      buf('nombre,sku,descripcion\n"Pan, grande",PN1,"Línea 1\nLínea 2"'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ nombre: 'Pan, grande', sku: 'PN1', descripcion: 'Línea 1\nLínea 2' });
  });

  it('desescapa comillas dobles dentro de un campo', () => {
    const { rows } = parseCsvBuffer(buf('nombre,sku\n"Pan ""especial""",PN1'));
    expect(rows[0].nombre).toBe('Pan "especial"');
  });

  it('no corta delimitador dentro de campo comillado para detectar el separador', () => {
    const { rows } = parseCsvBuffer(buf('nombre;sku\n"Pan, grande";PN1'));
    expect(rows[0]).toEqual({ nombre: 'Pan, grande', sku: 'PN1' });
  });

  it('normaliza encabezados con espacios, mayúsculas y saltos', () => {
    const { rows } = parseCsvBuffer(buf('  NOMBRE  , Precio de Venta ,codigo_de_barras\nPan,6.9,7501'));
    expect(rows[0]).toEqual({ nombre: 'Pan', precio_de_venta: '6.9', codigo_de_barras: '7501' });
  });

  it('normaliza acentos en encabezados', () => {
    const { rows } = parseCsvBuffer(buf('nombre,Código de barras\nPan,7501'));
    expect(rows[0]).toEqual({ nombre: 'Pan', código_de_barras: '7501' });
  });

  it('saltea filas vacías y líneas en blanco', () => {
    const { rows } = parseCsvBuffer(buf('nombre,sku\n\nPan,PN1\n\n\n'));
    expect(rows).toHaveLength(1);
  });

  it('soporta CRLF de Windows', () => {
    const { rows } = parseCsvBuffer(buf('nombre,sku\r\nPan,PN1\r\n'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ nombre: 'Pan', sku: 'PN1' });
  });

  it('completa columnas faltantes con string vacío', () => {
    const { rows } = parseCsvBuffer(buf('sku,nombre,precio_venta\nPN1,Pan'));
    expect(rows[0]).toEqual({ sku: 'PN1', nombre: 'Pan', precio_venta: '' });
  });

  it('devuelve rows vacíos para contenido en blanco', () => {
    expect(parseCsvBuffer(buf('')).rows).toEqual([]);
    expect(parseCsvBuffer(buf('\n\n'))).toEqual({ rows: [] });
  });
});