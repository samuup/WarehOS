import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { lastInsertRowid } from '../../main/database';

let handle: SqlJsDatabase;

beforeEach(async () => {
  const SQL = await initSqlJs();
  handle = new SQL.Database();
  handle.run('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT)');
});

afterEach(() => {
  handle.close();
});

describe('lastInsertRowid', () => {
  it('devuelve el rowid real de la última inserción', () => {
    handle.run('INSERT INTO t (v) VALUES (?)', ['a']);
    expect(lastInsertRowid(handle)).toBe(1);
    handle.run('INSERT INTO t (v) VALUES (?)', ['b']);
    expect(lastInsertRowid(handle)).toBe(2);
  });

  it('no devuelve NaN (dato de referencia del bug de products:create)', () => {
    handle.run('INSERT INTO t (v) VALUES (?)', ['x']);
    const id = lastInsertRowid(handle);
    expect(Number.isNaN(id)).toBe(false);
    expect(Number.isInteger(id)).toBe(true);
  });

  it('devuelve 0 cuando no hay ninguna inserción previa', () => {
    expect(lastInsertRowid(handle)).toBe(0);
  });
});