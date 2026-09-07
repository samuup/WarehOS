export interface CurrencyInfo {
  code: string;
  locale: string;
  label: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'PEN', locale: 'es-PE', label: 'Soles peruanos (S/ PEN)' },
  { code: 'USD', locale: 'en-US', label: 'Dólares (US$ USD)' },
  { code: 'EUR', locale: 'de-DE', label: 'Euros (€ EUR)' },
  { code: 'COP', locale: 'es-CO', label: 'Pesos colombianos ($ COP)' },
  { code: 'MXN', locale: 'es-MX', label: 'Pesos mexicanos ($ MXN)' },
  { code: 'ARS', locale: 'es-AR', label: 'Pesos argentinos ($ ARS)' },
  { code: 'CLP', locale: 'es-CL', label: 'Pesos chilenos ($ CLP)' },
  { code: 'BOB', locale: 'es-BO', label: 'Bolivianos (Bs BOB)' },
  { code: 'BRL', locale: 'pt-BR', label: 'Reales brasileños (R$ BRL)' },
  { code: 'GBP', locale: 'en-GB', label: 'Libras esterlinas (£ GBP)' },
  { code: 'JPY', locale: 'ja-JP', label: 'Yenes (¥ JPY)' },
  { code: 'CAD', locale: 'en-CA', label: 'Dólares canadienses (C$ CAD)' },
  { code: 'UYU', locale: 'es-UY', label: 'Pesos uruguayos ($ UYU)' },
  { code: 'PYG', locale: 'es-PY', label: 'Guaraníes (₲ PYG)' },
  { code: 'GTQ', locale: 'es-GT', label: 'Quetzales (Q GTQ)' },
  { code: 'CRC', locale: 'es-CR', label: 'Colones costarricenses (₡ CRC)' },
];

export const DEFAULT_CURRENCY = 'PEN';

export function isSupportedCurrency(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}

export function currencyLocale(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.locale ?? 'es-PE';
}