import { describe, it, expect } from 'vitest';
import { can, roleAtLeast } from '../../shared/permissions';

describe('can (permisos por rol)', () => {
  it('el admin tiene todas las capacidades', () => {
    expect(can('admin', 'products.manage')).toBe(true);
    expect(can('admin', 'inventory.manage')).toBe(true);
    expect(can('admin', 'users.manage')).toBe(true);
    expect(can('admin', 'settings.manage')).toBe(true);
    expect(can('admin', 'reports.view')).toBe(true);
  });

  it('solo el admin puede ver el log de auditoría (audit.view)', () => {
    expect(can('admin', 'audit.view')).toBe(true);
    expect(can('operator', 'audit.view')).toBe(false);
    expect(can('viewer', 'audit.view')).toBe(false);
  });

  it('el operador gestiona productos, inventario y categorías, pero no usuarios', () => {
    expect(can('operator', 'products.manage')).toBe(true);
    expect(can('operator', 'inventory.manage')).toBe(true);
    expect(can('operator', 'categories.manage')).toBe(true);
    expect(can('operator', 'reports.view')).toBe(true);
    expect(can('operator', 'users.manage')).toBe(false);
    expect(can('operator', 'users.create')).toBe(false);
    expect(can('operator', 'settings.manage')).toBe(false);
  });

  it('el visor solo puede ver reportes y gestionar su propia cuenta', () => {
    expect(can('viewer', 'reports.view')).toBe(true);
    expect(can('viewer', 'auth.self')).toBe(true);
    expect(can('viewer', 'products.manage')).toBe(false);
    expect(can('viewer', 'inventory.manage')).toBe(false);
    expect(can('viewer', 'categories.manage')).toBe(false);
    expect(can('viewer', 'settings.manage')).toBe(false);
  });

  it('sin rol o rol nulo no tiene permisos', () => {
    expect(can(undefined, 'reports.view')).toBe(false);
    expect(can(null, 'reports.view')).toBe(false);
  });
});

describe('roleAtLeast (jerarquía)', () => {
  it('respeta el orden viewer < operator < admin', () => {
    expect(roleAtLeast('operator', 'viewer')).toBe(true);
    expect(roleAtLeast('admin', 'operator')).toBe(true);
    expect(roleAtLeast('viewer', 'operator')).toBe(false);
    expect(roleAtLeast('operator', 'admin')).toBe(false);
  });

  it('sin rol o rol nulo nunca cumple el mínimo', () => {
    expect(roleAtLeast(undefined, 'viewer')).toBe(false);
    expect(roleAtLeast(null, 'admin')).toBe(false);
  });
});

describe('gestión de usuarios (capacidades del nuevo módulo Users)', () => {
  it('solo el admin puede listar/gestionar usuarios (users.manage)', () => {
    expect(can('admin', 'users.manage')).toBe(true);
    expect(can('operator', 'users.manage')).toBe(false);
    expect(can('viewer', 'users.manage')).toBe(false);
  });

  it('solo el admin puede crear cuentas (users.create) y asignar rol admin', () => {
    expect(can('admin', 'users.create')).toBe(true);
    expect(can('operator', 'users.create')).toBe(false);
    expect(can('viewer', 'users.create')).toBe(false);
  });

  it('el rol viewer es asignable por quien tenga users.create, y el admin por users.manage', () => {
    expect(can('admin', 'users.manage')).toBe(true);
    expect(can('operator', 'users.create')).toBe(false);
  });

  it('nigún rol distinto de admin puede gestionar usuarios', () => {
    expect(can('viewer', 'users.manage')).toBe(false);
    expect(can('operator', 'users.manage')).toBe(false);
    expect(can('viewer', 'users.create')).toBe(false);
  });
});
