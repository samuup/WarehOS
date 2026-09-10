import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { app, safeStorage } from 'electron';
import type { Database as SqlJsDatabase } from 'sql.js';
import {
  hasDbMagic,
  hasBackupMagic,
  encryptBytes,
  decryptBytes,
  encryptBackup,
  decryptBackup,
} from './dbEncryption';

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let db: SqlJsDatabase | null = null;
let dbPath = '';
let dbKey: Buffer | null = null;
let encryptionEnabled = false;

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('admin','operator','viewer')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    category_id INTEGER REFERENCES categories(id),
    unit TEXT NOT NULL DEFAULT 'uds',
    stock_min REAL NOT NULL DEFAULT 0,
    current_stock REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL CHECK(type IN ('IN','OUT','ADJUSTMENT')),
    quantity REAL NOT NULL,
    previous_stock REAL NOT NULL,
    new_stock REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    user_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    name TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    tax_id TEXT NOT NULL DEFAULT ''
  );`,

  `INSERT OR IGNORE INTO companies (id) VALUES (1);`,

  `ALTER TABLE users ADD COLUMN security_question TEXT;`,
  `ALTER TABLE users ADD COLUMN security_answer_hash TEXT;`,

  `ALTER TABLE companies ADD COLUMN currency TEXT NOT NULL DEFAULT 'VES';`,

  `ALTER TABLE products ADD COLUMN barcode TEXT;`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
   ON products (barcode) WHERE barcode IS NOT NULL AND barcode != '';`,

  `CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `INSERT INTO warehouses (name, is_default)
   SELECT 'Almacén Principal', 1
   WHERE NOT EXISTS (SELECT 1 FROM warehouses);`,

  `CREATE TABLE IF NOT EXISTS product_warehouse_stock (
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    stock REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, warehouse_id)
  );`,

  `ALTER TABLE stock_movements RENAME TO stock_movements_old;`,

  `CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL CHECK(type IN ('IN','OUT','ADJUSTMENT','TRANSFER')),
    quantity REAL NOT NULL,
    previous_stock REAL NOT NULL,
    new_stock REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    warehouse_id INTEGER REFERENCES warehouses(id),
    destination_warehouse_id INTEGER REFERENCES warehouses(id),
    user_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `INSERT INTO stock_movements (id, product_id, type, quantity, previous_stock, new_stock, note, user_id, created_at)
   SELECT id, product_id, type, quantity, previous_stock, new_stock, note, user_id, created_at
   FROM stock_movements_old;`,

  `DROP TABLE stock_movements_old;`,

  `INSERT OR IGNORE INTO product_warehouse_stock (product_id, warehouse_id, stock)
   SELECT p.id, w.id, p.current_stock
   FROM products p, warehouses w
   WHERE w.is_default = 1;`,

  `ALTER TABLE products ADD COLUMN track_lots INTEGER NOT NULL DEFAULT 0;`,

  `CREATE TABLE IF NOT EXISTS lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    batch TEXT NOT NULL,
    expiry_date TEXT,
    quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (product_id, warehouse_id, batch)
  );`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 0,
    user_name TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    entity TEXT NOT NULL DEFAULT '',
    entity_id INTEGER,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at);`,

  `-- Usuarios: reemplaza el email por un nombre de usuario.
   -- Con legacy_alter_table=OFF (default), SQLite reescribe las referencias FK
   -- de stock_movements al renombrar users -> users_old, rompiendo los movimientos.
   -- Se requiere legacy_alter_table=ON + foreign_keys=OFF durante el rebuild.
   PRAGMA legacy_alter_table = ON; PRAGMA foreign_keys = OFF;`,

  `ALTER TABLE users RENAME TO users_old;`,

  `CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('admin','operator','viewer')),
    security_question TEXT,
    security_answer_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `INSERT INTO users (id, name, username, password_hash, role, security_question, security_answer_hash, created_at)
   SELECT id, name,
          CASE
            WHEN email = 'admin@inventario.com' THEN 'admin'
            ELSE lower(trim(substr(email, 1, instr(email, '@') - 1)))
          END,
          password_hash, role, security_question, security_answer_hash, created_at
   FROM users_old;`,

  `DROP TABLE users_old;`,

  `PRAGMA legacy_alter_table = OFF; PRAGMA foreign_keys = ON;`,

  `-- Catálogo de monedas reducido a VES/USD/EUR: normaliza cualquier moneda
   -- guardada anteriormente (p. ej. PEN) al bolívar para las instalaciones existentes.`,
  `UPDATE companies SET currency = 'VES' WHERE currency NOT IN ('VES','USD','EUR');`,
];

function resolveDbKey(userDataPath: string): Buffer | null {
  const keyFilePath = path.join(userDataPath, 'inventario.key');
  try {
    if (fs.existsSync(keyFilePath)) {
      const stored = fs.readFileSync(keyFilePath);
      const base64 = safeStorage.decryptString(stored);
      return Buffer.from(base64, 'base64');
    }
    if (!safeStorage.isEncryptionAvailable()) return null;
    const key = crypto.randomBytes(32);
    const base64 = key.toString('base64');
    fs.writeFileSync(keyFilePath, safeStorage.encryptString(base64));
    return key;
  } catch {
    return null;
  }
}

export async function initDatabase() {
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'inventario.db');
  dbKey = resolveDbKey(userDataPath);
  encryptionEnabled = dbKey !== null;

  SQL = await initSqlJs({
    locateFile: (file) => path.join(path.dirname(require.resolve('sql.js')), file),
  });

  if (fs.existsSync(dbPath)) {
    db = loadDbFromRaw(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  applyMigrations(db);
  finalizeUserUsernames();
}

function loadDbFromRaw(raw: Buffer): SqlJsDatabase {
  if (!SQL) throw new Error('SQL.js no inicializado');
  if (hasDbMagic(raw)) {
    if (!dbKey) {
      throw new Error('No se puede descifrar la base de datos: falta la clave de cifrado');
    }
    return new SQL.Database(decryptBytes(raw, dbKey));
  }
  return new SQL.Database(raw);
}

export function applyMigrations(dbHandle: SqlJsDatabase): void {
  dbHandle.run('PRAGMA foreign_keys = ON;');

  dbHandle.run(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`,
  );

  const appliedResult = dbHandle.exec('SELECT version FROM schema_migrations');
  const appliedSet = new Set<number>();
  if (appliedResult.length > 0) {
    for (const row of appliedResult[0].values) {
      appliedSet.add(Number(row[0]));
    }
  }

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    if (!appliedSet.has(version)) {
      dbHandle.run(MIGRATIONS[i]);
      dbHandle.run(`INSERT INTO schema_migrations (version) VALUES (${version})`);
      persist(dbHandle);
    }
  }

  dbHandle.run('PRAGMA foreign_keys = ON;');
}

function finalizeUserUsernames(dbHandle?: SqlJsDatabase): void {
  const handle = (dbHandle ?? db) as SqlJsDatabase | null;
  if (!handle) return;
  const rows = allByHandle<{ id: number; username: string }>(
    handle,
    'SELECT id, username FROM users',
  );
  const used = new Set<string>();
  for (const row of rows) {
    let base = row.username?.trim().toLowerCase();
    if (!base || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/.test(base)) {
      base = `usuario_${row.id}`;
    }
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${n++}`;
    }
    if (candidate !== row.username) {
      handle.run('UPDATE users SET username = ? WHERE id = ?', [candidate, row.id]);
    }
    used.add(candidate);
  }
  handle.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  persist(handle);
}

function allByHandle<T = Record<string, unknown>>(handle: SqlJsDatabase, sql: string, params: SQLValue[] = []): T[] {
  const stmt = handle.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function seedDefaultAdmin(passwordHash: string, username: string, name: string): void {
  const existing = get('SELECT id FROM users WHERE role = "admin"');
  if (existing) return;
  run('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)', [
    name,
    username,
    passwordHash,
    'admin',
  ]);
  persist();
}

export function persist(dbHandle?: SqlJsDatabase) {
  const handle = dbHandle ?? db;
  if (!handle || !dbPath) return;
  const data = handle.export();
  const raw = Buffer.from(data);
  const out: Buffer = encryptionEnabled && dbKey ? encryptBytes(raw, dbKey) : raw;
  const tmp = `${dbPath}.tmp`;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, dbPath);
}

export function isDbEncryptionEnabled(): boolean {
  return encryptionEnabled;
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function getDbPath(): string {
  return dbPath;
}

export function reloadFromFile(sourcePath: string, password?: string): void {
  if (!SQL || !dbPath) {
    throw new Error('Database not initialized');
  }
  const data = fs.readFileSync(sourcePath);
  let raw: Buffer = data;
  if (hasBackupMagic(data)) {
    if (!password) {
      throw new Error('El backup está cifrado: ingresa la contraseña');
    }
    raw = decryptBackup(data, password);
  }

  const restored = new SQL.Database(raw);
  applyMigrations(restored);
  finalizeUserUsernames(restored);

  if (db) db.close();
  db = restored;
  persist();
}

export function saveBackupFile(targetPath: string, password: string): void {
  if (!db) throw new Error('Database not initialized');
  const data = db.export();
  const out = encryptBackup(Buffer.from(data), password);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, out);
}

// ── Helper de acceso a datos ───────────────────────────
type SQLValue = string | number | null | Uint8Array;

export function all<T = Record<string, unknown>>(sql: string, params: SQLValue[] = []): T[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function get<T = Record<string, unknown>>(sql: string, params: SQLValue[] = []): T | undefined {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  let result: T | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as T;
  }
  stmt.free();
  return result;
}

export function lastInsertRowid(handle: SqlJsDatabase): number {
  const rows = handle.exec('SELECT last_insert_rowid() AS id');
  return Number(rows && rows[0] ? rows[0].values[0][0] : 0);
}

export function run(
  sql: string,
  params: SQLValue[] = [],
): { lastInsertRowid: number; changes: number } {
  const handle = getDb();
  handle.run(sql, params);
  return { lastInsertRowid: lastInsertRowid(handle), changes: handle.getRowsModified() };
}

export function transaction(fn: () => void) {
  getDb().run('BEGIN TRANSACTION;');
  try {
    fn();
    getDb().run('COMMIT;');
    persist();
  } catch (err) {
    getDb().run('ROLLBACK;');
    throw err;
  }
}