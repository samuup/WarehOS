import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';

// Mantener sincronizados con los últimos pasos de MIGRATIONS en src/main/database.ts
const WAREHOUSE_MIGRATIONS = [
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
];

const LOT_MIGRATIONS = [
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
];

const AUDIT_MIGRATIONS = [
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
];

const require = createRequire(import.meta.url);
const sqlWasmDir = path.dirname(require.resolve('sql.js'));
let SQL: Awaited<ReturnType<typeof initSqlJs>>;
const dbs: SqlJsDatabase[] = [];

beforeAll(async () => {
  SQL = await initSqlJs({ locateFile: (file) => path.join(sqlWasmDir, file) });
});

afterEach(() => {
  dbs.splice(0).forEach((db) => db.close());
});

function createOldDb(): SqlJsDatabase {
  const db = new SQL.Database();
  dbs.push(db);
  db.run('PRAGMA foreign_keys = ON;');
  db.run(`CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  db.run(`CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    category_id INTEGER,
    unit TEXT NOT NULL DEFAULT 'uds',
    stock_min REAL NOT NULL DEFAULT 0,
    current_stock REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  db.run(`CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL CHECK(type IN ('IN','OUT','ADJUSTMENT')),
    quantity REAL NOT NULL,
    previous_stock REAL NOT NULL,
    new_stock REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    user_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  for (let i = 1; i <= 13; i++) {
    db.run(`INSERT INTO schema_migrations (version) VALUES (${i})`);
  }

  db.run(
    `INSERT INTO products (id, name, sku, current_stock) VALUES (1, 'Arroz', 'ARZ-01', 50)`,
  );
  db.run(
    `INSERT INTO products (id, name, sku, current_stock) VALUES (2, 'Aceite', 'ACE-01', 12)`,
  );
  db.run(`INSERT INTO users (id, name, email, password_hash, role) VALUES (1, 'Admin', 'a@a.com', 'x', 'admin')`);
  db.run(
    `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, user_id)
     VALUES (1, 'IN', 50, 0, 50, 1)`,
  );
  db.run(
    `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, user_id)
     VALUES (2, 'OUT', 3, 15, 12, 1)`,
  );
  return db;
}

describe('Migración de almacenes', () => {
  it('crea el almacén principal y migra el stock existente', () => {
    const db = createOldDb();

    let version = 13;
    for (const sql of [...WAREHOUSE_MIGRATIONS, ...LOT_MIGRATIONS, ...AUDIT_MIGRATIONS]) {
      version++;
      db.exec(sql);
      db.run(`INSERT INTO schema_migrations (version) VALUES (${version})`);
    }

    const warehouses = db.exec('SELECT id, name, is_default FROM warehouses')[0].values;
    expect(warehouses).toHaveLength(1);
    expect(warehouses[0][1]).toBe('Almacén Principal');
    expect(warehouses[0][2]).toBe(1);

    const stocks = db.exec(
      'SELECT product_id, stock FROM product_warehouse_stock ORDER BY product_id',
    )[0].values;
    expect(stocks).toEqual([
      [1, 50],
      [2, 12],
    ]);

    const trackLots = db.exec(
      "SELECT name FROM pragma_table_info('products') WHERE name = 'track_lots'",
    )[0].values;
    expect(trackLots).toEqual([['track_lots']]);
    db.exec('INSERT INTO products (name, sku, track_lots) VALUES (3, \'XYZ-01\', 1)');
    const trackValue = db.exec(
      'SELECT track_lots FROM products WHERE id = 3',
    )[0].values;
    expect(trackValue).toEqual([[1]]);

    const lotsTables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='lots'",
    )[0].values;
    expect(lotsTables).toEqual([['lots']]);

    db.exec(`INSERT INTO audit_log (user_id, user_name, action, entity) VALUES (1, 'Admin', 'login', 'user')`);
    const audit = db.exec('SELECT user_name, action FROM audit_log')[0].values;
    expect(audit).toEqual([['Admin', 'login']]);
  });

  it('conserva los movimientos históricos y permite TRANSFER', () => {
    const db = createOldDb();

    let version = 13;
    for (const sql of [...WAREHOUSE_MIGRATIONS, ...LOT_MIGRATIONS, ...AUDIT_MIGRATIONS]) {
      version++;
      db.exec(sql);
      db.run(`INSERT INTO schema_migrations (version) VALUES (${version})`);
    }

    const movements = db.exec(
      'SELECT id, product_id, type, quantity, previous_stock, new_stock FROM stock_movements ORDER BY id',
    )[0].values;
    expect(movements).toEqual([
      [1, 1, 'IN', 50, 0, 50],
      [2, 2, 'OUT', 3, 15, 12],
    ]);

    db.exec(
      `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, warehouse_id, destination_warehouse_id, user_id)
       VALUES (1, 'TRANSFER', 5, 50, 45, 1, 1, 1)`,
    );

    const transfer = db.exec(
      'SELECT type, warehouse_id, destination_warehouse_id FROM stock_movements WHERE id = 3',
    )[0].values;
    expect(transfer).toEqual([['TRANSFER', 1, 1]]);
  });

  it('vuelve a ejecutar la migración como fresh install (sin datos previos)', () => {
    const db = new SQL.Database();
    dbs.push(db);
    db.run(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);

    let version = 0;
    for (const sql of [
      `CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        category_id INTEGER,
        unit TEXT NOT NULL DEFAULT 'uds',
        stock_min REAL NOT NULL DEFAULT 0,
        current_stock REAL NOT NULL DEFAULT 0,
        cost_price REAL NOT NULL DEFAULT 0,
        sale_price REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE stock_movements (
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
      ...WAREHOUSE_MIGRATIONS,
      ...LOT_MIGRATIONS,
      ...AUDIT_MIGRATIONS,
    ]) {
      version++;
      db.exec(sql);
      db.run(`INSERT INTO schema_migrations (version) VALUES (${version})`);
    }

    const warehouses = db.exec('SELECT id FROM warehouses')[0].values;
    expect(warehouses).toHaveLength(1);
    const movements = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'")[0].values;
    expect(movements).toEqual([['stock_movements']]);
    const lots = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='lots'")[0].values;
    expect(lots).toEqual([['lots']]);
    const audit = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")[0].values;
    expect(audit).toEqual([['audit_log']]);
    const lotsCol = db.exec(
      "SELECT name FROM pragma_table_info('products') WHERE name = 'track_lots'",
    )[0].values;
    expect(lotsCol).toEqual([['track_lots']]);
  });
});

// Mantener sincronizado con los últimos pasos de MIGRATIONS en src/main/database.ts
const USER_EMAIL_MIGRATIONS = [
  `PRAGMA legacy_alter_table = ON; PRAGMA foreign_keys = OFF;`,
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
];

function finalizeUsernames(db: SqlJsDatabase): void {
  const rows = db.exec('SELECT id, username FROM users')[0].values as [number, string][];
  const used = new Set<string>();
  for (const [id, uname] of rows) {
    let base = (uname ?? '').trim().toLowerCase();
    if (!base || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/.test(base)) {
      base = `usuario_${id}`;
    }
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) candidate = `${base}_${n++}`;
    db.run('UPDATE users SET username = ? WHERE id = ?', [candidate, id]);
    used.add(candidate);
  }
  db.run('CREATE UNIQUE INDEX idx_users_username ON users(username)');
}

describe('Migración de email a username', () => {
  it('deriva usernames del email, conserva datos y no rompe las FK', () => {
    const db = new SQL.Database();
    dbs.push(db);
    db.run('PRAGMA foreign_keys = ON;');
    db.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('admin','operator','viewer')),
      security_question TEXT,
      security_answer_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
    db.run(`CREATE TABLE stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
    db.run(`INSERT INTO users (name, email, password_hash, role) VALUES
      ('Administrador', 'admin@inventario.com', 'h1', 'admin'),
      ('Juan', 'juan@empresa.com', 'h2', 'operator'),
      ('Maria', 'Maria@Empresa.com', 'h3', 'operator'),
      ('Pedro', 'pedro@x.com', 'h4', 'operator'),
      ('Pedro Segundo', 'PEDRO@y.com', 'h5', 'operator');`);
    db.run(`INSERT INTO stock_movements (product_id, type, quantity, user_id) VALUES (1, 'IN', 50, 1)`);

    for (const sql of USER_EMAIL_MIGRATIONS) db.exec(sql);
    finalizeUsernames(db);

    const users = db.exec('SELECT id, name, username FROM users ORDER BY id')[0].values;
    expect(users).toEqual([
      [1, 'Administrador', 'admin'],
      [2, 'Juan', 'juan'],
      [3, 'Maria', 'maria'],
      [4, 'Pedro', 'pedro'],
      [5, 'Pedro Segundo', 'pedro_2'],
    ]);

    const cols = db.exec('PRAGMA table_info(users)')[0].values.map((c) => c[1]);
    expect(cols).not.toContain('email');
    expect(cols).toContain('username');

    db.exec(`INSERT INTO stock_movements (product_id, type, quantity, user_id) VALUES (2, 'OUT', 5, 5)`);
    expect(db.exec('SELECT COUNT(*) FROM stock_movements')[0].values[0][0]).toBe(2);
  });

  it('falla al insertar un username duplicado (índice único)', () => {
    const db = new SQL.Database();
    dbs.push(db);
    db.run('PRAGMA foreign_keys = ON;');
    db.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      security_question TEXT,
      security_answer_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
    db.run(`INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@inventario.com', 'h', 'admin')`);
    for (const sql of USER_EMAIL_MIGRATIONS) db.exec(sql);
    finalizeUsernames(db);

    expect(() =>
      db.run(`INSERT INTO users (name, username, password_hash, role) VALUES ('Dup', 'admin', 'x', 'operator')`),
    ).toThrow();
  });
});