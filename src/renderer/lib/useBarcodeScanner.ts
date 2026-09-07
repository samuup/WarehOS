import { useEffect, useRef } from 'react';

export function useBarcodeScanner(
  onScan: (code: string) => void,
  options?: { minLength?: number; maxGapMs?: number; enabled?: boolean },
) {
  const { minLength = 3, maxGapMs = 60, enabled = true } = options ?? {};
  const bufferRef = useRef('');
  const lastTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        bufferRef.current = '';
        return;
      }

      const now = Date.now();
      if (now - lastTimeRef.current > maxGapMs) {
        bufferRef.current = '';
      }
      lastTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= minLength) {
          onScanRef.current(code);
        }
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      } else {
        bufferRef.current = '';
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, maxGapMs, minLength]);
}