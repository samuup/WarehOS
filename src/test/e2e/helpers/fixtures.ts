import { mkdtempSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Escribe un CSV de prueba y devuelve su ruta absoluta. */
export function writeCsvFixture(rows: string[][]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'warehos-csv-'));
  const file = path.join(dir, 'inventario.csv');
  writeFileSync(file, rows.map((r) => r.join(',')).join('\n'), 'utf8');
  return file;
}

/** Crea un directorio temporal para exportaciones (CSV/PDF). */
export function downloadDir(prefix = 'warehos-exports-'): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

/** Devuelve la ruta del archivo más reciente de un directorio. */
export function latestFile(dir: string): string {
  const files = readdirSync(dir).map((f) => path.join(dir, f));
  if (files.length === 0) throw new Error(`Sin archivos descargados en ${dir}`);
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0];
}

/** Espera (hasta `timeoutMs`) a que aparezca al menos un archivo y devuelve el más reciente. */
export function waitForDownload(dir: string, timeoutMs = 10_000): string {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return latestFile(dir);
    } catch {
      /* aún sin archivos */
    }
  }
  throw new Error(`No se descargó ningún archivo en ${dir}`);
}

/** Espera un archivo nuevo (mtime >= sinceMs) para no confundir descargas previas. */
export function waitForDownloadSince(
  dir: string,
  sinceMs: number,
  timeoutMs = 10_000,
  expectSuffix?: string,
): string {
  const deadline = Date.now() + timeoutMs;
  const staging = /\.(crdownload|part|tmp)$/i;
  while (Date.now() < deadline) {
    const files = readdirSync(dir)
      .map((f) => path.join(dir, f))
      .filter((f) => statSync(f).mtimeMs >= sinceMs)
      .filter((f) => !staging.test(f))
      .filter((f) => (expectSuffix ? f.endsWith(expectSuffix) : true));
    if (files.length > 0) {
      files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
      return files[0];
    }
  }
  throw new Error(`No se descargó ningún archivo nuevo en ${dir}`);
}

/** Lee el contenido del archivo más reciente de un directorio. */
export function readLatestFile(dir: string): string {
  return readFileSync(latestFile(dir), 'utf8');
}