import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  currencyLocale,
  isSupportedCurrency,
} from '@shared/currencies';

const CURRENCY_LOCALE: Record<string, { locale: string; code: string }> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, { locale: c.locale, code: c.code }]),
);

function resolveCurrency(currency: string): { locale: string; code: string } {
  return isSupportedCurrency(currency) ? CURRENCY_LOCALE[currency] : CURRENCY_LOCALE[DEFAULT_CURRENCY];
}

export function formatCurrency(value: number, currency = 'VES'): string {
  const cfg = resolveCurrency(currency);
  const formatted = new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.code,
  }).format(value);
  if (cfg.code === 'VES') {
    return formatted.replace(/Bs\.?S?/, 'Bs.');
  }
  return formatted;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatExpiry(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export type ExpiryBadgeStatus = 'expired' | 'near' | 'ok';

export function expiryStatus(date: string | null | undefined, thresholdDays = 30): ExpiryBadgeStatus {
  if (!date) return 'ok';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  if (d.getTime() < today.getTime()) return 'expired';
  const daysLeft = (d.getTime() - today.getTime()) / 86400000;
  return daysLeft <= thresholdDays ? 'near' : 'ok';
}

export function expiryStatusLabel(status: ExpiryBadgeStatus): string {
  return status === 'expired' ? 'Vencido' : status === 'near' ? 'Por vencer' : 'Vigente';
}

export function formatNumber(value: number, currency?: string): string {
  return new Intl.NumberFormat(currency ? currencyLocale(currency) : 'es-VE').format(value);
}

export const MOVEMENT_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  ADJUSTMENT: 'Ajuste',
  TRANSFER: 'Transferencia',
};

export const MOVEMENT_COLORS: Record<string, string> = {
  IN: 'text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-950/40',
  OUT: 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/40',
  ADJUSTMENT: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40',
  TRANSFER: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/40',
};

export const UNIT_OPTIONS = [
  'uds',
  'kg',
  'g',
  'l',
  'ml',
  'm',
  'cm',
  'mm',
  'cajas',
  'pzas',
  'rollos',
  'sacos',
];