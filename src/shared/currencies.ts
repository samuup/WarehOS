export interface CurrencyInfo {
  code: string;
  locale: string;
  label: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'VES', locale: 'es-VE', label: 'Bolívares (Bs VES)' },
  { code: 'USD', locale: 'en-US', label: 'Dólares (US$ USD)' },
  { code: 'EUR', locale: 'de-DE', label: 'Euros (€ EUR)' },
];

export const DEFAULT_CURRENCY = 'VES';

export function isSupportedCurrency(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}

export function currencyLocale(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.locale ?? 'es-VE';
}