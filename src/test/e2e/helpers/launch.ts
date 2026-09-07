import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface AppHandle {
  app: ElectronApplication;
  win: Page;
  userData: string;
  close: () => Promise<void>;
}

/**
 * Lanza la app empaquetada (dist/) contra una base de datos limpia y
 * aislada (WAREHOS_USER_DATA) y con los flujos Pro activados
 * (WAREHOS_FORCE_PRO, ver src/main/license.ts).
 */
export async function launchApp(options: { forcePro?: boolean } = {}): Promise<AppHandle> {
  const { forcePro = true } = options;
  const userData = mkdtempSync(path.join(tmpdir(), 'warehos-e2e-'));
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      WAREHOS_USER_DATA: userData,
      ...(forcePro ? { WAREHOS_FORCE_PRO: '1' } : {}),
    },
  });
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  return {
    app,
    win,
    userData,
    close: async () => {
      await app.close();
      rmSync(userData, { recursive: true, force: true });
    },
  };
}