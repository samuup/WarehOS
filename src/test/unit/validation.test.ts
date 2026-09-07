import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  isValidEmail,
  normalizeUsername,
  isValidUsername,
  isNonBlank,
  isValidPassword,
  isValidBackupPassword,
  isNonNegativeNumber,
  clampInt,
  cleanString,
} from '../../shared/validation';

describe('Validaciones de entrada', () => {
  it('normaliza emails a minúsculas sin espacios', () => {
    expect(normalizeEmail('  Admin@Empresa.COM ')).toBe('admin@empresa.com');
  });

  it('valida emails', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('  x@y.com ')).toBe(true);
    expect(isValidEmail('sin-arroba')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('normaliza nombres de usuario a minúsculas sin espacios', () => {
    expect(normalizeUsername('  Admin ')).toBe('admin');
    expect(normalizeUsername('Juan.Perez')).toBe('juan.perez');
  });

  it('valida nombres de usuario', () => {
    expect(isValidUsername('admin')).toBe(true);
    expect(isValidUsername('juan_perez')).toBe(true);
    expect(isValidUsername('user.123')).toBe(true);
    expect(isValidUsername(' a.b ')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a@b')).toBe(false);
    expect(isValidUsername('con espacios')).toBe(false);
    expect(isValidUsername('.inicia-con-punto')).toBe(false);
    expect(isValidUsername('termina-con-guion-')).toBe(false);
    expect(isValidUsername('x'.repeat(31))).toBe(false);
    expect(isValidUsername('')).toBe(false);
  });

  it('valida campos no vacíos con límite de longitud', () => {
    expect(isNonBlank('Producto')).toBe(true);
    expect(isNonBlank('  ')).toBe(false);
    expect(isNonBlank('')).toBe(false);
    expect(isNonBlank('x'.repeat(300), 200)).toBe(false);
    expect(isNonBlank(123 as unknown as string)).toBe(false);
  });

  it('limpia texto recortando y limitando longitud', () => {
    expect(cleanString('  hola  ')).toBe('hola');
    expect(cleanString('x'.repeat(500), 10)).toBe('x'.repeat(10));
  });

  it('valida contraseñas de al menos 6 caracteres', () => {
    expect(isValidPassword('123456')).toBe(true);
    expect(isValidPassword('12345')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });

  it('valida contraseñas de backup de al menos 8 caracteres', () => {
    expect(isValidBackupPassword('clave-super-segura')).toBe(true);
    expect(isValidBackupPassword('12345678')).toBe(true);
    expect(isValidBackupPassword('1234567')).toBe(false);
    expect(isValidBackupPassword('')).toBe(false);
    expect(isValidBackupPassword(12345678 as unknown as string)).toBe(false);
  });

  it('valida números no negativos', () => {
    expect(isNonNegativeNumber(0)).toBe(true);
    expect(isNonNegativeNumber(12.5)).toBe(true);
    expect(isNonNegativeNumber(-1)).toBe(false);
    expect(isNonNegativeNumber(Number.NaN)).toBe(false);
  });

  it('acota enteros a un rango con fallback', () => {
    expect(clampInt(5, 1, 10, 1)).toBe(5);
    expect(clampInt(50, 1, 10, 1)).toBe(10);
    expect(clampInt(-5, 1, 10, 1)).toBe(1);
    expect(clampInt(undefined, 1, 10, 3)).toBe(3);
    expect(clampInt(7.8, 1, 10, 1)).toBe(8);
  });
});