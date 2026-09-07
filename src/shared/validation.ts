export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;

export function isValidUsername(username: string): boolean {
  const s = username.trim();
  return s.length >= 3 && s.length <= 30 && USERNAME_RE.test(s);
}

export function cleanString(value: unknown, maxLength = 200): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function isNonBlank(value: unknown, maxLength = 200): boolean {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  return s.length > 0 && s.length <= maxLength;
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

export function isValidBackupPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8;
}

export function isNonNegativeNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  const n = Math.round(value);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}