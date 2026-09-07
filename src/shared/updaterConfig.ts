export function normalizeFeedUrl(value: string): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  parsed.hash = '';
  parsed.search = '';
  const href = parsed.href;
  return href.endsWith('/') ? href : `${href}/`;
}

export function isValidFeedUrl(value: string): boolean {
  return normalizeFeedUrl(value) !== null;
}