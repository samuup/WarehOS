import { ipcMain, dialog, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import XLSX from 'xlsx';
import { all, get, run, transaction, persist, reloadFromFile, saveBackupFile } from './database';
import {
  computeStockTrend,
  type TrendRow,
} from '../shared/chartLogic';
import { calculateNewStock } from '../shared/stockLogic';
import { fefoAllocate, redistributeLots } from '../shared/lotLogic';
import { mapImportRow } from '../shared/importParser';
import { parseCsvBuffer } from '../shared/csvImport';
import { normalizeBarcode } from '../shared/barcode';
import {
  normalizeUsername,
  isValidUsername,
  isNonBlank,
  isValidPassword,
  isNonNegativeNumber,
  cleanString,
  isValidBackupPassword,
} from '../shared/validation';
import type {
  ApiResult,
  User,
  UserInput,
  LoginCredentials,
  ChangePasswordInput,
  SetSecurityQuestionInput,
  ResetPasswordInput,
  SecurityQuestionInfo,
  Category,
  CategoryInput,
  Product,
  ProductInput,
  ImportRow,
  ImportResult,
  StockMovement,
  StockMovementInput,
  Company,
  CompanyInput,
  DashboardSummary,
  InventoryReportItem,
  UpdateConfigInput,
  Warehouse,
  WarehouseInput,
  Lot,
  ExpiringLot,
  SettingsInfo,
  SettingsInput,
  TopMovedProduct,
  StockByCategory,
  AuditLog,
  AuditLogQuery,
} from '../shared/types';
import { isSupportedCurrency } from '../shared/currencies';
import { getLicenseStatus, activateLicense, refreshTrialWatermark } from './license';
import { getUpdaterStatus, checkNow, installUpdate, setUpdateConfig } from './updater';
import {
  getNotifySettings,
  checkLowStockAndNotify,
  checkExpiryAndNotify,
  showTestNotification,
} from './notifications';
import { can, type Capability } from '../shared/permissions';
import { logError } from './logger';

type ProductRow = Omit<Product, 'track_lots' | 'stocks' | 'min_expiry'> & {
  track_lots: number;
};

function toProduct(row: ProductRow): Product {
  return { ...row, track_lots: row.track_lots === 1 };
}

const EXPIRY_THRESHOLD_KEY = 'expiry_threshold_days';

const NOTIFY_ENABLED_KEY = 'notify_low_stock';
const NOTIFY_EXPIRY_KEY = 'notify_expiry';
const NOTIFY_INTERVAL_KEY = 'notify_interval_min';

const LOGIN_LOCK_KEY = 'login_failures';
const RECOVERY_LOCK_KEY = 'recovery_failures';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

interface LoginFailure {
  count: number;
  lockedUntil?: number;
}

function readFailures(key: string): Record<string, LoginFailure> {
  const row = get<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [key]);
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value) as Record<string, LoginFailure>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeFailures(key: string, map: Record<string, LoginFailure>): void {
  run(
    'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(map)],
  );
  persist();
}

function remainingLockSeconds(key: string, username: string): number {
  const f = readFailures(key)[normalizeUsername(username)];
  if (!f?.lockedUntil) return 0;
  const remaining = f.lockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

function registerFailure(key: string, username: string): void {
  const map = readFailures(key);
  const entry: LoginFailure = map[username] ?? { count: 0 };
  entry.count = (entry.count ?? 0) + 1;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.count = 0;
  }
  map[username] = entry;
  writeFailures(key, map);
}

function clearFailures(key: string, username: string): void {
  const map = readFailures(key);
  if (!map[username]) return;
  delete map[username];
  writeFailures(key, map);
}

function getExpiryThresholdDays(): number {
  const row = get<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?',
    [EXPIRY_THRESHOLD_KEY],
  );
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : 30;
}

function listExpiringLots(): ExpiringLot[] {
  const days = getExpiryThresholdDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() + days);
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  const rows = all<{
    lot_id: number;
    product_id: number;
    product_name: string;
    product_sku: string;
    warehouse_id: number;
    warehouse_name: string;
    batch: string;
    expiry_date: string;
    quantity: number;
  }>(
    `SELECT l.id as lot_id, l.product_id, p.name as product_name, p.sku as product_sku,
            l.warehouse_id, w.name as warehouse_name, l.batch, l.expiry_date, l.quantity
     FROM lots l
     LEFT JOIN products p ON p.id = l.product_id
     LEFT JOIN warehouses w ON w.id = l.warehouse_id
     WHERE l.quantity > 0 AND l.expiry_date IS NOT NULL AND l.expiry_date != ''
       AND l.expiry_date <= ?
     ORDER BY l.expiry_date ASC`,
    [cutoff],
  );
  const todayKey = today.toISOString().slice(0, 10);
  return rows.map((r) => {
    const daysLeft = Math.floor(
      (new Date(`${r.expiry_date}T00:00:00`).getTime() - today.getTime()) / 86400000,
    );
    return {
      ...r,
      expiry_date: r.expiry_date as string | null,
      days_left: daysLeft,
      status: r.expiry_date < todayKey ? ('expired' as const) : ('near' as const),
    };
  });
}

function ok<T>(data: T): ApiResult<T> {
  return { success: true, data };
}

function fail(error: string): ApiResult<never> {
  return { success: false, error };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || 'Error interno';
  if (typeof err === 'string' && err) return err;
  return 'Error interno';
}

function logAudit(
  userId: number,
  action: string,
  entity: string,
  entityId?: number | null,
  detail?: string,
): void {
  const row = get<{ name: string }>('SELECT name FROM users WHERE id = ?', [userId]);
  run(
    `INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, row?.name ?? 'Sistema', action, entity, entityId ?? null, detail ?? ''],
  );
  persist();
}

function findRole(userId: number): 'admin' | 'operator' | 'viewer' | undefined {
  const row = get<{ role: 'admin' | 'operator' | 'viewer' }>(
    'SELECT role FROM users WHERE id = ?',
    [userId],
  );
  return row?.role;
}

function requireCapability(
  userId: number | undefined | null,
  capability: Capability,
): ApiResult<never> | null {
  if (userId == null) return fail('No autenticado');
  const role = findRole(userId);
  if (!role || !can(role, capability)) return fail('No tienes permisos para realizar esta acción');
  return null;
}

function requireLicenseActive(): ApiResult<never> | null {
  const status = getLicenseStatus();
  if (status.edition === 'trial_expired') {
    return fail('El periodo de prueba ha terminado. Activa una licencia para continuar usando la aplicación.');
  }
  return null;
}

function requirePro(): ApiResult<never> | null {
  const status = getLicenseStatus();
  if (status.edition !== 'pro') {
    return fail('Esta función requiere la versión Pro. Activa una licencia en Configuración.');
  }
  return null;
}

function getWarehouseStock(productId: number, warehouseId: number): number {
  const row = get<{ stock: number }>(
    'SELECT stock FROM product_warehouse_stock WHERE product_id = ? AND warehouse_id = ?',
    [productId, warehouseId],
  );
  return row?.stock ?? 0;
}

function upsertWarehouseStock(productId: number, warehouseId: number, stock: number): void {
  run(
    'INSERT INTO product_warehouse_stock (product_id, warehouse_id, stock) VALUES (?, ?, ?) ' +
      'ON CONFLICT(product_id, warehouse_id) DO UPDATE SET stock = excluded.stock',
    [productId, warehouseId, stock],
  );
}

function refreshGlobalStock(productId: number): void {
  run(
    `UPDATE products SET
       current_stock = COALESCE((SELECT SUM(stock) FROM product_warehouse_stock WHERE product_id = ?), 0),
       updated_at = datetime('now')
     WHERE id = ?`,
    [productId, productId],
  );
}

function getDefaultWarehouseId(): number | undefined {
  const row = get<{ id: number }>('SELECT id FROM warehouses WHERE is_default = 1');
  return row?.id;
}

function getWarehouseLots(productId: number, warehouseId: number): Lot[] {
  return all<Lot>(
    'SELECT * FROM lots WHERE product_id = ? AND warehouse_id = ?',
    [productId, warehouseId],
  );
}

function setWarehouseLots(productId: number, warehouseId: number, lots: Lot[]): void {
  run('DELETE FROM lots WHERE product_id = ? AND warehouse_id = ?', [productId, warehouseId]);
  for (const l of lots) {
    if (l.quantity <= 0) continue;
    run(
      'INSERT INTO lots (product_id, warehouse_id, batch, expiry_date, quantity) VALUES (?, ?, ?, ?, ?)',
      [productId, warehouseId, l.batch, l.expiry_date, l.quantity],
    );
  }
}

function upsertLotQuantity(
  productId: number,
  warehouseId: number,
  batch: string,
  expiry: string | null,
  delta: number,
): void {
  run(
    'INSERT INTO lots (product_id, warehouse_id, batch, expiry_date, quantity) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(product_id, warehouse_id, batch) DO UPDATE SET quantity = quantity + excluded.quantity',
    [productId, warehouseId, batch, expiry, delta],
  );
}

function applyFefoAllocations(lots: Lot[], allocations: { lot: Lot; qty: number }[]): Lot[] {
  const takenById = new Map<number, number>();
  for (const a of allocations) takenById.set(a.lot.id, a.qty);
  return lots
    .map((l) => ({ ...l, quantity: l.quantity - (takenById.get(l.id) ?? 0) }))
    .filter((l) => l.quantity > 0);
}

export function registerIpcHandlers(ipcMainApi: typeof ipcMain) {
  const safeHandle = <A extends unknown[], R>(
    channel: string,
    fn: (e: IpcMainInvokeEvent, ...args: A) => R,
  ) => {
    ipcMainApi.handle(channel, async (e: IpcMainInvokeEvent, ...args: A) => {
      try {
        return await fn(e, ...args);
      } catch (err) {
        const message = getErrorMessage(err);
        console.error(`[handler:${channel}] ${message}`, err instanceof Error ? err.stack : '');
        logError(`handler:${channel}`, err);
        return fail(message);
      }
    });
  };

  // ── Auth ──────────────────────────────────────────────
  safeHandle('auth:register', async (_e, input: UserInput, callerUserId?: number) => {
    const username = normalizeUsername(input?.username ?? '');
    const name = cleanString(input?.name, 60);
    if (!isNonBlank(name, 60)) return fail('El nombre es obligatorio');
    if (!isValidUsername(username)) {
      return fail('El usuario debe tener entre 3 y 30 caracteres (letras, números, . _ -)');
    }
    if (!isValidPassword(input?.password ?? '')) {
      return fail('La contraseña debe tener al menos 6 caracteres');
    }
    const existing = get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return fail('El nombre de usuario ya está registrado');
    let role: 'admin' | 'operator' | 'viewer' = 'operator';
    if (callerUserId != null) {
      const denied = requireCapability(callerUserId, 'users.create');
      if (denied) return denied;
    }
    if (callerUserId != null && input.role) {
      if (input.role === 'admin') {
        const manageDenied = requireCapability(callerUserId, 'users.manage');
        if (manageDenied) return fail('No tienes permisos para asignar el rol Admin');
        role = input.role;
      } else if (input.role === 'viewer') {
        role = input.role;
      }
    }
    const hash = bcrypt.hashSync(input.password, 10);
    const result = run(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, username, hash, role],
    );
    persist();
    const user = get<User>('SELECT id, name, username, role, created_at FROM users WHERE id = ?', [
      result.lastInsertRowid,
    ]);
    logAudit(
      callerUserId ?? result.lastInsertRowid,
      'register',
      'user',
      result.lastInsertRowid,
      `Rol: ${role}`,
    );
    return ok(user);
  });

  safeHandle('auth:login', async (_e, creds: LoginCredentials) => {
    const username = normalizeUsername(creds?.username ?? '');
    if (!username || !creds?.password) return fail('Credenciales inválidas');
    const lockSeconds = remainingLockSeconds(LOGIN_LOCK_KEY, username);
    if (lockSeconds > 0) {
      return fail(`Demasiados intentos fallidos. Intenta de nuevo en ${lockSeconds} segundos.`);
    }
    const user = get<{ password_hash: string } & User>(
      'SELECT * FROM users WHERE username = ?',
      [username],
    );
    if (!user) {
      registerFailure(LOGIN_LOCK_KEY, username);
      logAudit(0, 'login', 'user', null, `Intento fallido: ${username}`);
      return fail('Credenciales inválidas');
    }
    if (!bcrypt.compareSync(creds.password, user.password_hash)) {
      registerFailure(LOGIN_LOCK_KEY, username);
      logAudit(0, 'login', 'user', user.id, `Intento fallido: ${username}`);
      return fail('Credenciales inválidas');
    }
    clearFailures(LOGIN_LOCK_KEY, username);
    const safeUser: User = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
      mustChangePassword: bcrypt.compareSync('admin123', user.password_hash),
    };
    logAudit(user.id, 'login', 'user', user.id, `Sesión iniciada (${username})`);
    return ok(safeUser);
  });

  safeHandle('auth:me', async (_e, callerUserId: number) => {
    const user = get<{ password_hash: string } & User>('SELECT * FROM users WHERE id = ?', [callerUserId]);
    if (!user) return fail('Sesión no válida');
    return ok({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
      mustChangePassword: bcrypt.compareSync('admin123', user.password_hash),
    } satisfies User);
  });

  safeHandle('auth:listUsers', async (_e, callerUserId: number) => {
    const denied = requireCapability(callerUserId, 'users.manage');
    if (denied) return denied;
    const users = all<User>('SELECT id, name, username, role, created_at FROM users');
    return ok(users);
  });

  safeHandle('auth:deleteUser', async (_e, id: number, callerUserId: number) => {
    const denied = requireCapability(callerUserId, 'users.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const prev = get<{ name: string; role: string }>('SELECT name, role FROM users WHERE id = ?', [id]);
    if (!prev) return fail('Usuario no encontrado');
    if (prev.role === 'admin') return fail('No se puede eliminar el administrador');
    const { n } = get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM stock_movements WHERE user_id = ?',
      [id],
    ) ?? { n: 0 };
    if (n > 0) {
      return fail(
        `No se puede eliminar: el usuario "${prev.name}" tiene ${n} movimiento(s) registrado(s). Puedes cambiarle la contraseña o conservarlo.`,
      );
    }
    try {
      run('DELETE FROM users WHERE id = ?', [id]);
      persist();
    } catch {
      return fail('No se pudo eliminar el usuario');
    }
    logAudit(callerUserId, 'delete_user', 'user', id, prev?.name ?? '');
    return ok(null);
  });

  safeHandle(
    'auth:changePassword',
    async (_e, input: ChangePasswordInput) => {
      const user = get<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = ?',
        [input.userId],
      );
      if (!user) return fail('Usuario no encontrado');
      if (!bcrypt.compareSync(input.currentPassword, user.password_hash)) {
        return fail('La contraseña actual es incorrecta');
      }
      if (!isValidPassword(input.newPassword ?? '')) {
        return fail('La nueva contraseña debe tener al menos 6 caracteres');
      }
      const hash = bcrypt.hashSync(input.newPassword, 10);
      run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, input.userId]);
      persist();
      logAudit(input.userId, 'change_password', 'user', input.userId);
      return ok(null);
    },
  );

  safeHandle('auth:setSecurityQuestion', async (_e, input: SetSecurityQuestionInput) => {
    if (!isNonBlank(input.question, 120) || !isNonBlank(input.answer, 200)) {
      return fail('La pregunta y la respuesta no pueden estar vacías');
    }
    const answerHash = bcrypt.hashSync(input.answer.trim(), 10);
    run('UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?', [
      input.question.trim(),
      answerHash,
      input.userId,
]);
    persist();
    logAudit(input.userId, 'set_security_question', 'user', input.userId);
    return ok(null);
  });

  safeHandle(
    'auth:getSecurityQuestion',
    async (_e, username: string) => {
      const user = get<{ security_question: string | null }>(
        'SELECT security_question FROM users WHERE username = ?',
        [normalizeUsername(username)],
      );
      if (!user || !user.security_question) {
        return ok<SecurityQuestionInfo>({ set: false, question: '' });
      }
      return ok<SecurityQuestionInfo>({ set: true, question: user.security_question });
    },
  );

  safeHandle('auth:resetPassword', async (_e, input: ResetPasswordInput) => {
    const username = normalizeUsername(input.username);
    const lockSeconds = remainingLockSeconds(RECOVERY_LOCK_KEY, username);
    if (lockSeconds > 0) {
      return fail(`Demasiados intentos fallidos. Intenta de nuevo en ${lockSeconds} segundos.`);
    }
    const user = get<{ id: number; security_answer_hash: string | null }>(
      'SELECT id, security_answer_hash FROM users WHERE username = ?',
      [username],
    );
    if (!user || !user.security_answer_hash) {
      registerFailure(RECOVERY_LOCK_KEY, username);
      return fail('No hay pregunta de seguridad configurada para este usuario');
    }
    if (!bcrypt.compareSync(input.answer.trim(), user.security_answer_hash)) {
      registerFailure(RECOVERY_LOCK_KEY, username);
      return fail('La respuesta de seguridad es incorrecta');
    }
    clearFailures(RECOVERY_LOCK_KEY, username);
    if (!isValidPassword(input.newPassword ?? '')) {
      return fail('La nueva contraseña debe tener al menos 6 caracteres');
    }
    const hash = bcrypt.hashSync(input.newPassword, 10);
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    persist();
    logAudit(user.id, 'reset_password', 'user', user.id);
    return ok(null);
  });

  // ── Categories ────────────────────────────────────────
  safeHandle('categories:list', async () => {
    const rows = all<Category>('SELECT * FROM categories ORDER BY name');
    return ok(rows);
  });

  safeHandle('categories:create', async (_e, input: CategoryInput, userId: number) => {
    const denied = requireCapability(userId, 'categories.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const name = cleanString(input?.name, 80);
    if (!isNonBlank(name, 80)) return fail('El nombre es obligatorio');
    const result = run('INSERT INTO categories (name, description) VALUES (?, ?)', [
      name,
      cleanString(input?.description, 200),
    ]);
    persist();
    const cat = get<Category>('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
    logAudit(userId, 'create', 'category', result.lastInsertRowid, name);
    return ok(cat);
  });

  safeHandle('categories:update', async (_e, id: number, input: CategoryInput, userId: number) => {
    const denied = requireCapability(userId, 'categories.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const name = cleanString(input?.name, 80);
    if (!isNonBlank(name, 80)) return fail('El nombre es obligatorio');
    run('UPDATE categories SET name = ?, description = ? WHERE id = ?', [
      name,
      cleanString(input?.description, 200),
      id,
    ]);
    persist();
    const cat = get<Category>('SELECT * FROM categories WHERE id = ?', [id]);
    logAudit(userId, 'update', 'category', id, input.name);
    return ok(cat);
  });

  safeHandle('categories:delete', async (_e, id: number, userId: number) => {
    const denied = requireCapability(userId, 'categories.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const prev = get<{ name: string }>('SELECT name FROM categories WHERE id = ?', [id]);
    const hasProducts = get<{ c: number }>(
      'SELECT COUNT(*) as c FROM products WHERE category_id = ?',
      [id],
    );
    if (hasProducts && hasProducts.c > 0)
      return fail('No se puede eliminar: hay productos en esta categoría');
    run('DELETE FROM categories WHERE id = ?', [id]);
    persist();
    logAudit(userId, 'delete', 'category', id, prev?.name ?? '');
    return ok(null);
  });

  // ── Warehouses ───────────────────────────────────────
  safeHandle('warehouses:list', async () => {
    const rows = all<Warehouse>('SELECT * FROM warehouses ORDER BY is_default DESC, name');
    return ok(rows);
  });

  safeHandle('warehouses:create', async (_e, input: WarehouseInput, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    if (!input.name?.trim()) return fail('El nombre es obligatorio');
    const result = run(
      `INSERT INTO warehouses (name, address) VALUES (?, ?)`,
      [input.name.trim(), input.address.trim()],
    );
    persist();
    const wh = get<Warehouse>('SELECT * FROM warehouses WHERE id = ?', [result.lastInsertRowid]);
    logAudit(userId, 'create', 'warehouse', result.lastInsertRowid, input.name.trim());
    return ok(wh);
  });

  safeHandle(
    'warehouses:update',
    async (_e, id: number, input: WarehouseInput, userId: number) => {
      const denied = requireCapability(userId, 'settings.manage');
      if (denied) return denied;
      const license = requireLicenseActive();
      if (license) return license;
      if (!input.name?.trim()) return fail('El nombre es obligatorio');
      run(`UPDATE warehouses SET name = ?, address = ? WHERE id = ?`, [
        input.name.trim(),
        input.address.trim(),
        id,
      ]);
      persist();
      const wh = get<Warehouse>('SELECT * FROM warehouses WHERE id = ?', [id]);
      logAudit(userId, 'update', 'warehouse', id, input.name.trim());
      return ok(wh);
    },
  );

  safeHandle('warehouses:delete', async (_e, id: number, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const prev = get<{ is_default: number; name: string }>(
      'SELECT is_default, name FROM warehouses WHERE id = ?',
      [id],
    );
    if (!prev) return fail('Almacén no encontrado');
    if (prev.is_default) return fail('No se puede eliminar el almacén principal');
    const warehouseCount = get<{ c: number }>('SELECT COUNT(*) as c FROM warehouses');
    if (warehouseCount && warehouseCount.c <= 1) return fail('Debe existir al menos un almacén');
    const hasStock = get<{ c: number }>(
      'SELECT COUNT(*) as c FROM product_warehouse_stock WHERE warehouse_id = ? AND stock != 0',
      [id],
    );
    if (hasStock && hasStock.c > 0)
      return fail('No se puede eliminar: el almacén tiene stock. Transfiérelo primero.');
    const hasMovements = get<{ c: number }>(
      'SELECT COUNT(*) as c FROM stock_movements WHERE warehouse_id = ? OR destination_warehouse_id = ?',
      [id, id],
    );
    if (hasMovements && hasMovements.c > 0)
      return fail('No se puede eliminar: el almacén tiene movimientos registrados');
    transaction(() => {
      run('DELETE FROM product_warehouse_stock WHERE warehouse_id = ?', [id]);
      run('DELETE FROM warehouses WHERE id = ?', [id]);
    });
    logAudit(userId, 'delete', 'warehouse', id, prev.name);
    return ok(null);
  });

  // ── Products ──────────────────────────────────────────
  safeHandle(
    'products:list',
    async (_e, params?: { search?: string; category_id?: number; warehouse_id?: number }) => {
      let sql =
        'SELECT p.*, c.name as category_name FROM products p ' +
        'LEFT JOIN categories c ON c.id = p.category_id WHERE 1=1';
      const binds: (string | number)[] = [];

      if (params?.search) {
        sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
        const q = `%${params.search}%`;
        binds.push(q, q, q);
      }
      if (params?.category_id) {
        sql += ` AND p.category_id = ?`;
        binds.push(params.category_id);
      }
      sql += ` ORDER BY p.name`;
      const rows = all<ProductRow>(sql, binds);

      const stockRows = all<{ product_id: number; warehouse_id: number; stock: number }>(
        'SELECT product_id, warehouse_id, stock FROM product_warehouse_stock',
      );
      const stocksByProduct: Record<number, Record<number, number>> = {};
      for (const r of stockRows) {
        if (!stocksByProduct[r.product_id]) stocksByProduct[r.product_id] = {};
        stocksByProduct[r.product_id][r.warehouse_id] = r.stock;
      }

      const lotRows = all<{ product_id: number; expiry_date: string | null }>(
        'SELECT product_id, expiry_date FROM lots WHERE quantity > 0 AND expiry_date IS NOT NULL AND expiry_date != \'\'',
      );
      const minExpiryByProduct: Record<number, string> = {};
      for (const r of lotRows) {
        if (!minExpiryByProduct[r.product_id] || r.expiry_date! < minExpiryByProduct[r.product_id]) {
          minExpiryByProduct[r.product_id] = r.expiry_date!;
        }
      }

      const enriched: Product[] = rows.map((p) => {
        const stocks = stocksByProduct[p.id] ?? {};
        const product = { ...toProduct(p), stocks } as Product;
        if (p.track_lots === 1) product.min_expiry = minExpiryByProduct[p.id] ?? null;
        if (params?.warehouse_id) product.current_stock = stocks[params.warehouse_id] ?? 0;
        return product;
      });
      return ok(enriched);
    },
  );

  safeHandle('products:get', async (_e, id: number) => {
    const row = get<ProductRow>(
      'SELECT p.*, c.name as category_name FROM products p ' +
        'LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?',
      [id],
    );
    if (!row) return fail('Producto no encontrado');
    const stocks: Record<number, number> = {};
    for (const s of all<{ warehouse_id: number; stock: number }>(
      'SELECT warehouse_id, stock FROM product_warehouse_stock WHERE product_id = ?',
      [id],
    )) {
      stocks[s.warehouse_id] = s.stock;
    }
    return ok({ ...toProduct(row), stocks });
  });

  safeHandle('products:getByBarcode', async (_e, barcode: string) => {
    const normalized = normalizeBarcode(barcode);
    if (!normalized) return fail('Código de barras inválido');
    const row = get<ProductRow>(
      'SELECT p.*, c.name as category_name FROM products p ' +
        'LEFT JOIN categories c ON c.id = p.category_id WHERE p.barcode = ?',
      [normalized],
    );
    if (!row) return fail('Producto no encontrado');
    return ok(toProduct(row));
  });

  safeHandle('products:create', async (_e, input: ProductInput, userId: number) => {
    const denied = requireCapability(userId, 'products.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const name = cleanString(input?.name, 120);
    const sku = cleanString(input?.sku, 60);
    if (!isNonBlank(name, 120) || !isNonBlank(sku, 60)) {
      return fail('El nombre y el SKU son obligatorios');
    }
    const numbers = [input.stock_min, input.cost_price, input.sale_price];
    if (!numbers.every((n) => isNonNegativeNumber(Number(n)))) {
      return fail('Precios y stock mínimo no pueden ser negativos');
    }
    const existing = get('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing) return fail('El SKU ya existe');
    const barcode = normalizeBarcode(input.barcode);
    if (barcode) {
      const barcodeExists = get('SELECT id FROM products WHERE barcode = ?', [barcode]);
      if (barcodeExists) return fail('El código de barras ya existe');
    }
    let productId = 0;
    transaction(() => {
      const result = run(
        `INSERT INTO products (name, sku, barcode, description, category_id, unit, stock_min, cost_price, sale_price, track_lots)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          sku,
          barcode,
          cleanString(input.description, 300),
          input.category_id,
          input.unit,
          input.stock_min,
          input.cost_price,
          input.sale_price,
          input.track_lots ? 1 : 0,
        ],
      );
      productId = result.lastInsertRowid;
      const defaultWh = getDefaultWarehouseId();
      if (defaultWh) upsertWarehouseStock(productId, defaultWh, 0);
    });
    const product = get<ProductRow>('SELECT * FROM products WHERE id = ?', [productId]);
    logAudit(userId, 'create', 'product', productId, name);
    return ok(toProduct(product!));
  });

  safeHandle('products:update', async (_e, id: number, input: ProductInput, userId: number) => {
    const denied = requireCapability(userId, 'products.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const name = cleanString(input?.name, 120);
    const sku = cleanString(input?.sku, 60);
    if (!isNonBlank(name, 120) || !isNonBlank(sku, 60)) {
      return fail('El nombre y el SKU son obligatorios');
    }
    const numbers = [input.stock_min, input.cost_price, input.sale_price];
    if (!numbers.every((n) => isNonNegativeNumber(Number(n)))) {
      return fail('Precios y stock mínimo no pueden ser negativos');
    }
    const existing = get('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, id]);
    if (existing) return fail('El SKU ya existe');
    const barcode = normalizeBarcode(input.barcode);
    if (barcode) {
      const barcodeExists = get('SELECT id FROM products WHERE barcode = ? AND id != ?', [
        barcode,
        id,
      ]);
      if (barcodeExists) return fail('El código de barras ya existe');
    }
    const prev = get<{ track_lots: number }>('SELECT track_lots FROM products WHERE id = ?', [id]);
    const trackLots = input.track_lots ? 1 : 0;
    transaction(() => {
      run(
        `UPDATE products SET name=?, sku=?, barcode=?, description=?, category_id=?, unit=?, stock_min=?, cost_price=?, sale_price=?, track_lots=?, updated_at=datetime('now')
         WHERE id=?`,
        [
          name,
          sku,
          barcode,
          cleanString(input.description, 300),
          input.category_id,
          input.unit,
          input.stock_min,
          input.cost_price,
          input.sale_price,
          trackLots,
          id,
        ],
      );
      if (trackLots && prev?.track_lots !== 1) {
        for (const s of all<{ warehouse_id: number; stock: number }>(
          'SELECT warehouse_id, stock FROM product_warehouse_stock WHERE product_id = ? AND stock != 0',
          [id],
        )) {
          run(
            'INSERT OR IGNORE INTO lots (product_id, warehouse_id, batch, expiry_date, quantity) VALUES (?, ?, ?, ?, ?)',
            [id, s.warehouse_id, 'Inicial', null, s.stock],
          );
        }
      } else if (!trackLots && prev?.track_lots === 1) {
        run('DELETE FROM lots WHERE product_id = ?', [id]);
      }
    });
    const product = get<ProductRow>('SELECT * FROM products WHERE id = ?', [id]);
    logAudit(userId, 'update', 'product', id, input.name);
    return ok(toProduct(product!));
  });

  safeHandle('products:delete', async (_e, id: number, userId: number) => {
    const denied = requireCapability(userId, 'products.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const hasMovements = get<{ c: number }>(
      'SELECT COUNT(*) as c FROM stock_movements WHERE product_id = ?',
      [id],
    );
    if (hasMovements && hasMovements.c > 0)
      return fail('No se puede eliminar: el producto tiene movimientos registrados');
    const prev = get<{ name: string }>('SELECT name FROM products WHERE id = ?', [id]);
    transaction(() => {
      run('DELETE FROM lots WHERE product_id = ?', [id]);
      run('DELETE FROM product_warehouse_stock WHERE product_id = ?', [id]);
      run('DELETE FROM products WHERE id = ?', [id]);
    });
    logAudit(userId, 'delete', 'product', id, prev?.name ?? '');
    return ok(null);
  });

safeHandle('products:import', async (_e, userId: number) => {
    const denied = requireCapability(userId, 'products.manage');
    if (denied) return denied;
    const license = requirePro();
    if (license) return license;
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Seleccionar archivo para importar productos',
      filters: [
        { name: 'Hoja de cálculo', extensions: ['csv', 'xlsx', 'xls'] },
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Excel', extensions: ['xlsx', 'xls'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return ok<ImportResult>({ canceled: true, created: 0, skipped: 0, errors: [] });
    }

    const filePath = result.filePaths[0];
    let rows: ImportRow[];
    try {
      const buf = fs.readFileSync(filePath);
      const isCsv = /\.csv$/i.test(filePath);
      const json = isCsv
        ? parseCsvBuffer(buf).rows
        : (() => {
            const workbook = XLSX.read(buf, { type: 'buffer', raw: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
          })();
      rows = json
        .map(mapImportRow)
        .filter((r): r is ImportRow => r !== null && !!r.nombre);
    } catch (err) {
      return fail('No se pudo leer el archivo: ' + (err as Error).message);
    }

    const result2: ImportResult = { canceled: false, created: 0, skipped: 0, errors: [] };
    const defaultWh = getDefaultWarehouseId();

    transaction(() => {
      for (const row of rows) {
        const existing = get('SELECT id FROM products WHERE sku = ?', [row.sku]);
        if (existing) {
          result2.skipped++;
          result2.errors.push(`SKU duplicado (omitido): ${row.sku} - ${row.nombre}`);
          continue;
        }

        const categoryId: number | null = row.categoria ? getOrCreateCategory(row.categoria) : null;

        if (!row.sku) {
          result2.skipped++;
          result2.errors.push(`Falta SKU: ${row.nombre}`);
          continue;
        }

        const barcode = normalizeBarcode(row.barcode);
        if (barcode) {
          const barcodeExists = get('SELECT id FROM products WHERE barcode = ?', [barcode]);
          if (barcodeExists) {
            result2.skipped++;
            result2.errors.push(`Código de barras duplicado (omitido): ${barcode} - ${row.nombre}`);
            continue;
          }
        }

        const insertResult = run(
          `INSERT INTO products (name, sku, barcode, description, category_id, unit, stock_min, current_stock, cost_price, sale_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.nombre,
            row.sku,
            barcode,
            row.descripcion || '',
            categoryId,
            row.unidad || 'uds',
            row.stock_min || 0,
            row.stock_inicial || 0,
            row.costo || 0,
            row.precio_venta || 0,
          ],
        );
        if (defaultWh) {
          run(
            'INSERT OR IGNORE INTO product_warehouse_stock (product_id, warehouse_id, stock) VALUES (?, ?, ?)',
            [insertResult.lastInsertRowid, defaultWh, row.stock_inicial || 0],
          );
        }
        result2.created++;
      }
    });

    logAudit(userId, 'import', 'product', null, `Creados: ${result2.created}, omitidos: ${result2.skipped}`);
    return ok(result2);
  });

  function getOrCreateCategory(name: string): number {
    const cat = get<Category>('SELECT id FROM categories WHERE name = ?', [name]);
    if (cat) return cat.id;
    const result = run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, '']);
    return result.lastInsertRowid;
  }

  // ── Stock Movements ──────────────────────────────────
  safeHandle(
    'movements:list',
    async (
      _e,
      params?: {
        product_id?: number;
        type?: string;
        from?: string;
        to?: string;
        warehouse_id?: number;
      },
    ) => {
      let sql =
        'SELECT m.*, p.name as product_name, p.sku as product_sku, u.name as user_name, ' +
        'w.name as warehouse_name, dw.name as destination_warehouse_name ' +
        'FROM stock_movements m ' +
        'LEFT JOIN products p ON p.id = m.product_id ' +
        'LEFT JOIN users u ON u.id = m.user_id ' +
        'LEFT JOIN warehouses w ON w.id = m.warehouse_id ' +
        'LEFT JOIN warehouses dw ON dw.id = m.destination_warehouse_id WHERE 1=1';
      const binds: (string | number)[] = [];

      if (params?.product_id) {
        sql += ` AND m.product_id = ?`;
        binds.push(params.product_id);
      }
      if (params?.type) {
        sql += ` AND m.type = ?`;
        binds.push(params.type);
      }
      if (params?.from) {
        sql += ` AND m.created_at >= ?`;
        binds.push(`${params.from} 00:00:00`);
      }
      if (params?.to) {
        sql += ` AND m.created_at <= ?`;
        binds.push(`${params.to} 23:59:59`);
      }
      if (params?.warehouse_id) {
        sql += ` AND (m.warehouse_id = ? OR m.destination_warehouse_id = ?)`;
        binds.push(params.warehouse_id, params.warehouse_id);
      }
      sql += ` ORDER BY m.created_at DESC`;
      const rows = all<StockMovement>(sql, binds);
      return ok(rows);
    },
  );

  safeHandle('movements:create', async (_e, input: StockMovementInput, userId: number) => {
    const denied = requireCapability(userId, 'inventory.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const product = get<ProductRow>('SELECT * FROM products WHERE id = ?', [input.product_id]);
    if (!product) return fail('Producto no encontrado');
    const trackLots = product.track_lots === 1;

    const warehouseId = input.warehouse_id ?? getDefaultWarehouseId();
    if (!warehouseId) return fail('No hay almacenes configurados. Crea un almacén primero.');
    if (!get('SELECT id FROM warehouses WHERE id = ?', [warehouseId])) {
      return fail('Almacén no encontrado');
    }

    if (trackLots && input.type === 'IN') {
      if (!input.batch?.trim()) return fail('El producto controla lotes: ingresa el número de lote');
      const expiry = input.expiry_date?.trim() || null;
      if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
        return fail('La fecha de vencimiento debe tener formato AAAA-MM-DD');
      }
    }

    if (input.type === 'TRANSFER') {
      const destinationWarehouseId = input.destination_warehouse_id;
      if (!destinationWarehouseId) return fail('Selecciona el almacén de destino');
      if (destinationWarehouseId === warehouseId) {
        return fail('El almacén de origen y el de destino deben ser diferentes');
      }
      if (!get('SELECT id FROM warehouses WHERE id = ?', [destinationWarehouseId])) {
        return fail('Almacén de destino no encontrado');
      }

      const sourceStock = getWarehouseStock(product.id, warehouseId);
      const destStock = getWarehouseStock(product.id, destinationWarehouseId);
      const calc = calculateNewStock('TRANSFER', input.quantity, sourceStock);
      if (calc.error) return fail(calc.error);

      const sourceLots = trackLots ? getWarehouseLots(product.id, warehouseId) : null;
      const allocations = trackLots
        ? fefoAllocate(sourceLots!, input.quantity)
        : null;
      if (allocations && !allocations.ok) return fail(allocations.error ?? 'Stock insuficiente');

      transaction(() => {
        if (allocations && allocations.ok) {
          setWarehouseLots(product.id, warehouseId, applyFefoAllocations(sourceLots!, allocations.allocations));
          for (const a of allocations.allocations) {
            if (a.qty > 0) upsertLotQuantity(product.id, destinationWarehouseId, a.lot.batch, a.lot.expiry_date, a.qty);
          }
        }
        run(
          `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, note, warehouse_id, destination_warehouse_id, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            'TRANSFER',
            input.quantity,
            sourceStock,
            calc.newStock,
            input.note,
            warehouseId,
            destinationWarehouseId,
            userId,
          ],
        );
        upsertWarehouseStock(product.id, warehouseId, calc.newStock);
        upsertWarehouseStock(product.id, destinationWarehouseId, destStock + input.quantity);
        refreshGlobalStock(product.id);
      });

      const originName =
        get<{ name: string }>('SELECT name FROM warehouses WHERE id = ?', [warehouseId])?.name ??
        '';
      const destName =
        get<{ name: string }>('SELECT name FROM warehouses WHERE id = ?', [
          destinationWarehouseId,
        ])?.name ?? '';
      logAudit(
        userId,
        'create',
        'movement',
        null,
        `Transferencia ${input.quantity} ${product.name} (${originName} → ${destName})${input.batch ? ` · lote ${input.batch}` : ''}`,
      );

      const movement = get<StockMovement>(
        `SELECT m.*, p.name as product_name, p.sku as product_sku
         FROM stock_movements m
         LEFT JOIN products p ON p.id = m.product_id
         WHERE m.product_id = ? ORDER BY m.id DESC LIMIT 1`,
        [product.id],
      );
      return ok(movement);
    }

    const warehouseStock = getWarehouseStock(product.id, warehouseId);
    const calc = calculateNewStock(input.type, input.quantity, warehouseStock);
    if (calc.error) return fail(calc.error);

    let adoNewLots: Lot[] | null = null;
    if (trackLots && input.type === 'OUT') {
      const lots = getWarehouseLots(product.id, warehouseId);
      const alloc = fefoAllocate(lots, input.quantity);
      if (!alloc.ok) return fail(alloc.error ?? 'Stock insuficiente');
      adoNewLots = applyFefoAllocations(lots, alloc.allocations);
    } else if (trackLots && input.type === 'ADJUSTMENT') {
      const lots = getWarehouseLots(product.id, warehouseId);
      const res = redistributeLots(lots, input.quantity);
      if (!res.ok) return fail(res.error ?? 'No se puede reasignar');
      adoNewLots = res.newLots;
    }

    transaction(() => {
      if (trackLots && input.type === 'IN') {
        upsertLotQuantity(
          product.id,
          warehouseId,
          input.batch!.trim(),
          input.expiry_date?.trim() || null,
          input.quantity,
        );
      } else if (adoNewLots) {
        setWarehouseLots(product.id, warehouseId, adoNewLots);
      }
      run(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, note, warehouse_id, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id,
          input.type,
          input.quantity,
          warehouseStock,
          calc.newStock,
          input.note,
          warehouseId,
          userId,
        ],
      );
      upsertWarehouseStock(product.id, warehouseId, calc.newStock);
      refreshGlobalStock(product.id);
    });

logAudit(
        userId,
        'create',
        'movement',
        null,
        `${input.type} ${input.quantity} ${product.name}${input.batch ? ` · lote ${input.batch}` : ''}`,
      );

      const movement = get<StockMovement>(
        `SELECT m.*, p.name as product_name, p.sku as product_sku
         FROM stock_movements m
         LEFT JOIN products p ON p.id = m.product_id
         WHERE m.product_id = ? ORDER BY m.id DESC LIMIT 1`,
        [product.id],
      );
      return ok(movement);
    });

  // ── Lots ─────────────────────────────────────────────
  safeHandle('lots:list', async (_e, productId: number) => {
    if (!get('SELECT id FROM products WHERE id = ?', [productId])) {
      return fail('Producto no encontrado');
    }
    const rows = all<Lot>(
      `SELECT l.*, w.name as warehouse_name
       FROM lots l
       LEFT JOIN warehouses w ON w.id = l.warehouse_id
       WHERE l.product_id = ?
       ORDER BY (l.expiry_date IS NULL), l.expiry_date ASC, l.batch ASC`,
      [productId],
    );
    return ok(rows);
  });

  safeHandle('lots:expiring', async () => {
    return ok(listExpiringLots());
  });

  // ── Audit ────────────────────────────────────────────
  safeHandle('audit:list', async (_e, callerUserId: number, query?: AuditLogQuery) => {
    const denied = requireCapability(callerUserId, 'audit.view');
    if (denied) return denied;
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const binds: (string | number)[] = [];
    if (query?.action) {
      sql += ' AND action = ?';
      binds.push(query.action);
    }
    if (query?.entity) {
      sql += ' AND entity = ?';
      binds.push(query.entity);
    }
    if (query?.user_id) {
      sql += ' AND user_id = ?';
      binds.push(query.user_id);
    }
    if (query?.from) {
      sql += ' AND created_at >= ?';
      binds.push(`${query.from} 00:00:00`);
    }
    if (query?.to) {
      sql += ' AND created_at <= ?';
      binds.push(`${query.to} 23:59:59`);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    binds.push(query?.limit ?? 500);
    const rows = all<AuditLog>(sql, binds);
    return ok(rows);
  });

  // ── Dashboard ────────────────────────────────────────
  safeHandle('dashboard:summary', async () => {
    const totals = get<{ total_products: number; total_stock_value: number }>(
      `SELECT COUNT(*) as total_products,
              COALESCE(SUM(current_stock * cost_price), 0) as total_stock_value
       FROM products`,
    );
    const categories = get<{ c: number }>('SELECT COUNT(*) as c FROM categories');
    const movements = get<{ c: number }>('SELECT COUNT(*) as c FROM stock_movements');

    const lowStock = all<Product>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.current_stock <= p.stock_min AND p.stock_min > 0
       ORDER BY (p.current_stock * 1.0 / p.stock_min) ASC
       LIMIT 20`,
    );

    const recent = all<StockMovement>(
      `SELECT m.*, p.name as product_name, p.sku as product_sku
       FROM stock_movements m
       LEFT JOIN products p ON p.id = m.product_id
       ORDER BY m.created_at DESC LIMIT 10`,
    );

    const trendRows = all<TrendRow>(
      `SELECT type, quantity, new_stock, warehouse_id, destination_warehouse_id, created_at
       FROM stock_movements ORDER BY created_at ASC, id ASC`,
    );
    const stock_trend = computeStockTrend(trendRows, 30);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = `${thirtyDaysAgo.toISOString().slice(0, 10)} 00:00:00`;
    const top_moved = all<TopMovedProduct>(
      `SELECT p.id as product_id, p.name, p.unit, SUM(m.quantity) as quantity
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       WHERE m.type = 'OUT' AND m.created_at >= ?
       GROUP BY m.product_id
       ORDER BY quantity DESC
       LIMIT 6`,
      [since],
    );

    const stock_by_category = all<StockByCategory>(
      `SELECT p.category_id, COALESCE(c.name, 'Sin categoría') as category_name, SUM(p.current_stock) as total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       GROUP BY p.category_id
       HAVING total > 0
       ORDER BY total DESC`,
    );

    const summary: DashboardSummary = {
      total_products: totals?.total_products ?? 0,
      total_categories: categories?.c ?? 0,
      total_movements: movements?.c ?? 0,
      total_stock_value: totals?.total_stock_value ?? 0,
      low_stock_count: lowStock.length,
      recent_movements: recent,
      low_stock_products: lowStock,
      expiring_lots: listExpiringLots(),
      stock_trend,
      top_moved,
      stock_by_category,
    };
    return ok(summary);
  });

  // ── Reports ──────────────────────────────────────────
  safeHandle('reports:inventory', async () => {
    const rows = all<InventoryReportItem>(
      `SELECT p.id as product_id, p.name as product_name, p.sku as product_sku,
              c.name as category_name, p.unit, p.current_stock,
              p.cost_price, ROUND(p.current_stock * p.cost_price, 2) as stock_value
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.name`,
    );
    return ok(rows);
  });

  // ── Settings / Company ────────────────────────────────
  safeHandle('settings:get', async () => {
    const notify = getNotifySettings();
    return ok<SettingsInfo>({
      expiry_threshold_days: getExpiryThresholdDays(),
      notify_low_stock: notify.enabled,
      notify_expiry: notify.expiryEnabled,
      notify_interval_min: notify.intervalMin,
    });
  });

  safeHandle('settings:update', async (_e, input: SettingsInput, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    if (input.expiry_threshold_days !== undefined) {
      const n = Number(input.expiry_threshold_days);
      if (!Number.isInteger(n) || n < 1 || n > 365) {
        return fail('El umbral de vencimiento debe ser un entero entre 1 y 365 días');
      }
      run(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [EXPIRY_THRESHOLD_KEY, String(n)],
      );
      logAudit(userId, 'update', 'settings', null, `Umbral de vencimiento: ${n} días`);
    }
    if (input.notify_low_stock !== undefined) {
      run(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [NOTIFY_ENABLED_KEY, input.notify_low_stock ? '1' : '0'],
      );
      logAudit(
        userId,
        'update',
        'settings',
        null,
        `Notificaciones de stock bajo: ${input.notify_low_stock ? 'activadas' : 'desactivadas'}`,
      );
    }
    if (input.notify_expiry !== undefined) {
      run(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [NOTIFY_EXPIRY_KEY, input.notify_expiry ? '1' : '0'],
      );
      logAudit(
        userId,
        'update',
        'settings',
        null,
        `Notificaciones de vencimiento: ${input.notify_expiry ? 'activadas' : 'desactivadas'}`,
      );
    }
    if (input.notify_interval_min !== undefined) {
      const n = Number(input.notify_interval_min);
      if (!Number.isInteger(n) || n < 5 || n > 1440) {
        return fail('El intervalo debe ser un entero entre 5 y 1440 minutos');
      }
      run(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [NOTIFY_INTERVAL_KEY, String(n)],
      );
      logAudit(userId, 'update', 'settings', null, `Intervalo de notificaciones: ${n} min`);
    }
    persist();
    const notify = getNotifySettings();
    return ok<SettingsInfo>({
      expiry_threshold_days: getExpiryThresholdDays(),
      notify_low_stock: notify.enabled,
      notify_expiry: notify.expiryEnabled,
      notify_interval_min: notify.intervalMin,
    });
  });

  safeHandle('company:get', async () => {
    const company = get<Company>('SELECT * FROM companies WHERE id = 1');
    return ok(company);
  });

  safeHandle('company:update', async (_e, input: CompanyInput, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    const license = requireLicenseActive();
    if (license) return license;
    const name = cleanString(input?.name, 120);
    if (!isNonBlank(name, 120)) return fail('El nombre de la empresa es obligatorio');
    if (!isSupportedCurrency(input?.currency ?? 'VES')) return fail('La moneda no es válida');
    run(
      'UPDATE companies SET name=?, address=?, phone=?, email=?, tax_id=?, currency=? WHERE id=1',
      [
        name,
        cleanString(input.address, 200),
        cleanString(input.phone, 40),
        cleanString(input.email, 120),
        cleanString(input.tax_id, 40),
        input.currency,
      ],
    );
    persist();
    const company = get<Company>('SELECT * FROM companies WHERE id = 1');
    logAudit(userId, 'update', 'company', 1, name);
    return ok(company);
  });

  // ── Notificaciones de stock bajo y vencimientos ────
  safeHandle('notifications:test', async (_e, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    return ok(showTestNotification());
  });

  safeHandle('notifications:check', async (_e, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    return ok({
      lowStock: checkLowStockAndNotify().count,
      expiring: checkExpiryAndNotify().count,
    });
  });

  // ── Logs del renderer (captura de errores de UI) ──
  safeHandle('logger:error', async (_e, scope: string, message: string) => {
    logError(scope || 'renderer', message || '');
    return ok(true);
  });

  // ── Backup ────────────────────────────────────────────
  safeHandle(
    'backup:export',
    async (_e, targetPath: string, password: string, userId: number) => {
      const denied = requireCapability(userId, 'settings.manage');
      if (denied) return denied;
      const license = requirePro();
      if (license) return license;
      if (!isValidBackupPassword(password)) {
        return fail('La contraseña del backup debe tener al menos 8 caracteres');
      }
      try {
        saveBackupFile(targetPath, password);
        logAudit(userId, 'export', 'backup', null, targetPath);
        return ok(true);
      } catch (err) {
        return fail('Error al exportar backup: ' + (err as Error).message);
      }
    },
  );

  safeHandle(
    'backup:import',
    async (_e, sourcePath: string, password: string, userId: number) => {
      const denied = requireCapability(userId, 'settings.manage');
      if (denied) return denied;
      const license = requirePro();
      if (license) return license;
      try {
        reloadFromFile(sourcePath, password);
        refreshTrialWatermark();
        logAudit(userId, 'import', 'backup', null, sourcePath);
        return ok(true);
      } catch (err) {
        return fail('Error al importar backup: ' + (err as Error).message);
      }
    },
  );

  // ── License ────────────────────────────────────────────
  safeHandle('license:getStatus', async () => {
    return ok(getLicenseStatus());
  });

  safeHandle('license:activate', async (_e, key: string, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    const result = activateLicense(key);
    if (!result.ok) return fail(result.reason);
    logAudit(userId, 'activate', 'license', null, 'Activación Pro');
    return ok(getLicenseStatus());
  });

  // ── Updates ────────────────────────────────────────────
  safeHandle('updates:getStatus', async () => {
    return ok(getUpdaterStatus());
  });

  safeHandle('updates:check', async (_e, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    const result = await checkNow();
    return result.ok ? ok(true) : fail(result.reason ?? 'No se pudo comprobar');
  });

  safeHandle('updates:install', async (_e, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    const result = installUpdate();
    return result.ok ? ok(true) : fail(result.reason ?? 'No se pudo instalar');
  });

  safeHandle('updates:setConfig', async (_e, input: UpdateConfigInput, userId: number) => {
    const denied = requireCapability(userId, 'settings.manage');
    if (denied) return denied;
    const result = setUpdateConfig(input);
    if (result.ok) {
      logAudit(userId, 'update', 'settings', null, 'Configuración de actualizaciones');
    }
    return result.ok ? ok(getUpdaterStatus()) : fail(result.reason ?? 'No se pudo guardar');
  });
}