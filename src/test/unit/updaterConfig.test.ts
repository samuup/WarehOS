import { describe, it, expect } from 'vitest';
import { normalizeFeedUrl, isValidFeedUrl } from '../../shared/updaterConfig';

describe('normalizeFeedUrl', () => {
  it('devuelve null para entradas vacías o de solo espacios', () => {
    expect(normalizeFeedUrl('')).toBeNull();
    expect(normalizeFeedUrl('   ')).toBeNull();
    expect(normalizeFeedUrl(undefined as unknown as string)).toBeNull();
  });

  it('acepta URLs http y https y elimina espacios', () => {
    expect(normalizeFeedUrl('  https://updates.example.com/warehos/ ')).toBe(
      'https://updates.example.com/warehos/',
    );
    expect(normalizeFeedUrl('http://updates.example.com/warehos/')).toBe(
      'http://updates.example.com/warehos/',
    );
  });

  it('agrega la barra final si falta', () => {
    expect(normalizeFeedUrl('https://updates.example.com/warehos')).toBe(
      'https://updates.example.com/warehos/',
    );
    expect(normalizeFeedUrl('https://example.com')).toBe('https://example.com/');
  });

  it('limpia query y hash', () => {
    expect(normalizeFeedUrl('https://updates.example.com/warehos?token=1#x')).toBe(
      'https://updates.example.com/warehos/',
    );
  });

  it('rechaza protocolos no soportados', () => {
    expect(normalizeFeedUrl('ftp://updates.example.com/')).toBeNull();
    expect(normalizeFeedUrl('file:///tmp/updates')).toBeNull();
  });

  it('rechaza URLs inválidas y con credenciales', () => {
    expect(normalizeFeedUrl('no-es-una-url')).toBeNull();
    expect(normalizeFeedUrl('https://user:pass@updates.example.com/')).toBeNull();
  });
});

describe('isValidFeedUrl', () => {
  it('cumple con normalizeFeedUrl', () => {
    expect(isValidFeedUrl('https://updates.example.com/warehos')).toBe(true);
    expect(isValidFeedUrl('ftp://x.example.com')).toBe(false);
    expect(isValidFeedUrl('')).toBe(false);
  });
});