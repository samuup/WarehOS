import { Notification, BrowserWindow } from 'electron';
import { all, get } from './database';
import { findLowStock, buildLowStockMessage } from '../shared/lowStockLogic';

const NOTIFY_ENABLED_KEY = 'notify_low_stock';
const NOTIFY_INTERVAL_KEY = 'notify_interval_min';

export function getNotifySettings(): { enabled: boolean; intervalMin: number } {
  const enabledRow = get<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    NOTIFY_ENABLED_KEY,
  ]);
  const intervalRow = get<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [
    NOTIFY_INTERVAL_KEY,
  ]);
  const interval = Number(intervalRow?.value);
  return {
    enabled: enabledRow?.value === '1',
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

export function showTestNotification(): { shown: boolean } {
  if (!Notification.isSupported()) return { shown: false };
  const notification = new Notification({
    title: 'WarehOS · Notificaciones activadas',
    body: 'Así se verán las alertas de stock bajo.',
  });
  notification.on('click', focusMainWindow);
  notification.show();
  return { shown: true };
}

let watcherTimer: NodeJS.Timeout | null = null;

export function startLowStockWatcher(initialDelayMs = 15000): void {
  if (watcherTimer) return;
  const { intervalMin } = getNotifySettings();
  watcherTimer = setInterval(() => {
    checkLowStockAndNotify();
  }, Math.max(intervalMin, 1) * 60_000);
  setTimeout(() => {
    checkLowStockAndNotify();
  }, initialDelayMs);
}