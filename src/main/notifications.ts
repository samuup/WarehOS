import { Notification, BrowserWindow } from 'electron';
import { all, get } from './database';
import { findLowStock, buildLowStockMessage } from '../shared/lowStockLogic';
import { buildExpiryMessage, type ExpiringLotNote } from '../shared/expiryLogic';

const NOTIFY_ENABLED_KEY = 'notify_low_stock';
const NOTIFY_EXPIRY_KEY = 'notify_expiry';
const NOTIFY_INTERVAL_KEY = 'notify_interval_min';
const EXPIRY_THRESHOLD_KEY = 'expiry_threshold_days';

export function getNotifySettings(): { enabled: boolean; expiryEnabled: boolean; intervalMin: number } {
  const enabledRow = get<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    NOTIFY_ENABLED_KEY,
  ]);
  const expiryRow = get<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    NOTIFY_EXPIRY_KEY,
  ]);
  const intervalRow = get<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    NOTIFY_INTERVAL_KEY,
  ]);
  const interval = Number(intervalRow?.value);
  return {
    enabled: enabledRow?.value === '1',
    expiryEnabled: expiryRow?.value === '1',
    intervalMin: Number.isInteger(interval) && interval >= 5 && interval <= 1440 ? interval : 60,
  };
}

function focusMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

export function checkLowStockAndNotify(): { count: number } {
  const settings = getNotifySettings();
  if (!settings.enabled) return { count: 0 };
  if (!Notification.isSupported()) return { count: 0 };

  const products = all<{ id: number; name: string; sku: string; current_stock: number; stock_min: number }>(
    `SELECT id, name, sku, current_stock, stock_min
     FROM products
     WHERE stock_min > 0 AND current_stock <= stock_min
     ORDER BY current_stock / stock_min ASC`,
  );
  const low = findLowStock(products);
  if (low.length === 0) return { count: 0 };

  const notification = new Notification({
    title: `Stock bajo — ${low.length} producto${low.length === 1 ? '' : 's'}`,
    body: buildLowStockMessage(low),
  });
  notification.on('click', focusMainWindow);
  notification.show();
  return { count: low.length };
}

function listExpiringLotNotes(): ExpiringLotNote[] {
  const thresholdRow = get<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    EXPIRY_THRESHOLD_KEY,
  ]);
  const n = Number(thresholdRow?.value);
  const threshold = Number.isInteger(n) && n >= 1 && n <= 365 ? n : 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + threshold);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);

  const rows = all<{ product_name: string; sku: string; batch: string; expiry_date: string }>(
    `SELECT p.name as product_name, p.sku, l.batch, l.expiry_date
     FROM lots l
     JOIN products p ON p.id = l.product_id
     WHERE l.quantity > 0 AND l.expiry_date IS NOT NULL AND l.expiry_date != ''
       AND l.expiry_date <= ?
     ORDER BY l.expiry_date ASC`,
    [cutoffKey],
  );

  return rows.map((r) => ({
    productName: r.product_name,
    sku: r.sku,
    batch: r.batch,
    expiryDate: r.expiry_date,
    daysLeft: Math.floor(
      (new Date(`${r.expiry_date}T00:00:00`).getTime() - today.getTime()) / 86400000,
    ),
    status: r.expiry_date < todayKey ? ('expired' as const) : ('near' as const),
  }));
}

export function checkExpiryAndNotify(): { count: number } {
  const settings = getNotifySettings();
  if (!settings.expiryEnabled) return { count: 0 };
  if (!Notification.isSupported()) return { count: 0 };

  const expiring = listExpiringLotNotes();
  if (expiring.length === 0) return { count: 0 };

  const notification = new Notification({
    title: `Lotes por vencer — ${expiring.length} lote${expiring.length === 1 ? '' : 's'}`,
    body: buildExpiryMessage(expiring),
  });
  notification.on('click', focusMainWindow);
  notification.show();
  return { count: expiring.length };
}

export function showTestNotification(): { shown: boolean } {
  if (!Notification.isSupported()) return { shown: false };
  const notification = new Notification({
    title: 'WarehOS · Notificaciones activadas',
    body: 'Así se verán las alertas de stock bajo y lotes por vencer.',
  });
  notification.on('click', focusMainWindow);
  notification.show();
  return { shown: true };
}

let watcherTimer: NodeJS.Timeout | null = null;
let initialWatchTimer: NodeJS.Timeout | null = null;

export function startLowStockWatcher(initialDelayMs = 15000): void {
  if (watcherTimer) return;
  const { intervalMin } = getNotifySettings();
  watcherTimer = setInterval(() => {
    checkLowStockAndNotify();
    checkExpiryAndNotify();
  }, Math.max(intervalMin, 1) * 60_000);
  initialWatchTimer = setTimeout(() => {
    checkLowStockAndNotify();
    checkExpiryAndNotify();
  }, initialDelayMs);
}

export function stopLowStockWatcher(): void {
  if (watcherTimer) {
    clearInterval(watcherTimer);
    watcherTimer = null;
  }
  if (initialWatchTimer) {
    clearTimeout(initialWatchTimer);
    initialWatchTimer = null;
  }
}