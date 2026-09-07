import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let logDir: string | null = null;

function dir(): string {
  if (!logDir) {
    logDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

export function logError(scope: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const stack = err instanceof Error && err.stack ? `\n${err.stack}` : '';
  const line = `[${new Date().toISOString()}] [${scope}] ${message}${stack}\n`;
  try {
    fs.appendFileSync(path.join(dir(), 'app.log'), line);
  } catch {
    console.error(line);
  }
}

export function initGlobalErrorLogging(): void {
  process.on('uncaughtException', (err) => {
    logError('uncaughtException', err);
    app.quit();
  });
  process.on('unhandledRejection', (reason) => {
    logError('unhandledRejection', reason);
  });
}