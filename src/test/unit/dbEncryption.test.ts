import { describe, it, expect } from 'vitest';
import {
  hasDbMagic,
  hasBackupMagic,
  encryptBytes,
  decryptBytes,
  encryptBackup,
  decryptBackup,
} from '../../main/dbEncryption';

describe('Cifrado de base de datos en disco', () => {
  const key = Buffer.from('a'.repeat(32), 'utf8');

  it('cifra y descifra un payload redondeando el contenido original', () => {
    const data = Buffer.from(
      JSON.stringify({ products: [{ id: 1, name: 'Arroz' }] }),
      'utf8',
    );
    const encrypted = encryptBytes(data, key);
    expect(hasDbMagic(encrypted)).toBe(true);
    expect(encrypted).not.toEqual(data);
    expect(decryptBytes(encrypted, key)).toEqual(data);
  });

  it('genera cifrados distintos aunque el payload sea igual (nonce aleatorio)', () => {
    const data = Buffer.from('mismo contenido');
    const a = encryptBytes(data, key);
    const b = encryptBytes(data, key);
    expect(a).not.toEqual(b);
    expect(decryptBytes(a, key)).toEqual(data);
    expect(decryptBytes(b, key)).toEqual(data);
  });

  it('distingue un archivo heredado sin cifrar', () => {
    const plain = Buffer.from('archivo legacy sqlite');
    expect(hasDbMagic(plain)).toBe(false);
  });

  it('falla al descifrar con una clave distinta', () => {
    const data = Buffer.from('secreto');
    const encrypted = encryptBytes(data, key);
    const wrongKey = Buffer.from('b'.repeat(32), 'utf8');
    expect(() => decryptBytes(encrypted, wrongKey)).toThrow();
  });
});

describe('Cifrado de backups con contraseña', () => {
  const payload = Buffer.from(
    JSON.stringify({ movements: [{ id: 1, qty: 5 }] }),
    'utf8',
  );
  const password = 'clave-super-segura';

  it('cifra y descifra un backup redondeando el contenido original', () => {
    const encrypted = encryptBackup(payload, password);
    expect(hasBackupMagic(encrypted)).toBe(true);
    expect(encrypted).not.toEqual(payload);
    expect(decryptBackup(encrypted, password)).toEqual(payload);
  });

  it('genera cifrados distintos aunque el payload sea igual (sal y nonce aleatorios)', () => {
    const a = encryptBackup(payload, password);
    const b = encryptBackup(payload, password);
    expect(a).not.toEqual(b);
    expect(decryptBackup(a, password)).toEqual(payload);
    expect(decryptBackup(b, password)).toEqual(payload);
  });

  it('falla con una contraseña incorrecta', () => {
    const encrypted = encryptBackup(payload, password);
    expect(() => decryptBackup(encrypted, 'otra-clave-distinta')).toThrow(
      /Contraseña incorrecta/,
    );
  });

  it('distingue un backup heredado sin cifrar (texto plano)', () => {
    const legacy = Buffer.from(
      'SQLite format 3\x00payload-heredado',
      'utf8',
    );
    expect(hasBackupMagic(legacy)).toBe(false);
  });

  it('rechaza un archivo sin formato de backup', () => {
    expect(() => decryptBackup(Buffer.from('basura'), password)).toThrow(
      /no es un backup cifrado/,
    );
  });
});