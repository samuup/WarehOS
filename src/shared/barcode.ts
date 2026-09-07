export function normalizeBarcode(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim().toUpperCase();
  return trimmed === '' ? null : trimmed;
}