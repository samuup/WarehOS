import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateInfo as UpdateInfoDto, ProgressInfo } from 'electron-updater';
import { get, run, persist, closeDatabase } from './database';
import { stopLowStockWatcher } from './notifications';
import { normalizeFeedUrl } from '../shared/updaterConfig';
import type {
  UpdaterStatus,
  UpdaterEvent,
  UpdateConfigInput,
  UpdateInfo,
  UpdateProgress,
} from '../shared/types';

const FEED_KEY = 'update_feed';
const AUTO_CHECK_KEY = 'update_auto_check';
const EVENT_CHANNEL = 'updates:event';
const STARTUP_CHECK_DELAY_MS = 10000;

type RuntimeStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';

interface RuntimeState {
  status: RuntimeStatus;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | undefined;
  checkingInFlight: boolean;
}

const initialRuntime: RuntimeState = {
  status: 'idle',
  info: null,
  progress: null,
  error: undefined,
  checkingInFlight: false,
};

let runtime: RuntimeState = { ...initialRuntime };
let initialized = false;

function readConfig(): { feedUrl: string; autoCheck: boolean } {
  const feed = get<{ value: string }>("SELECT value FROM app_state WHERE key = ?", [FEED_KEY]);
  const auto = get<{ value: string }>("SELECT value FROM app_state WHERE key = ?", [
    AUTO_CHECK_KEY,
  ]);
  return { feedUrl: feed?.value ?? '', autoCheck: auto?.value === '1' };
}

function emit(payload: UpdaterEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(EVENT_CHANNEL, payload);
  }
}

function updateRuntime(patch: Partial<RuntimeState>): void {
  runtime = { ...runtime, ...patch };
  emit({ type: 'state', status: getUpdaterStatus() });
}

function toProgress(p: ProgressInfo): UpdateProgress {
  return {
    bytesPerSecond: p.bytesPerSecond,
    percent: p.percent,
    total: p.total,
    transferred: p.transferred,
  };
}

function toUpdateInfo(p: UpdateInfoDto): UpdateInfo {
  return {
    version: p.version,
    releaseDate: p.releaseDate || undefined,
  };
}

function applyFeedUrl(feedUrl: string): void {
  const url = normalizeFeedUrl(feedUrl);
  if (url) {
    autoUpdater.setFeedURL({ provider: 'generic', url });
  }
}

function setupListeners(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () => {
    updateRuntime({ status: 'checking', error: undefined });
    emit({ type: 'checking' });
  });
  autoUpdater.on('update-available', (info: UpdateInfoDto) => {
    const parsed = toUpdateInfo(info);
    updateRuntime({ status: 'downloading', info: parsed, progress: null, error: undefined });
    emit({ type: 'update-available', info: parsed });
  });
  autoUpdater.on('update-not-available', () => {
    updateRuntime({ status: 'idle', info: null, progress: null, error: undefined });
    emit({ type: 'update-not-available' });
  });
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    const parsed = toProgress(progress);
    updateRuntime({ status: 'downloading', progress: parsed, error: undefined });
    emit({ type: 'download-progress', progress: parsed });
  });
  autoUpdater.on('update-downloaded', (info: UpdateInfoDto) => {
    const parsed = toUpdateInfo(info);
    updateRuntime({ status: 'downloaded', info: parsed, progress: null, error: undefined });
    emit({ type: 'update-downloaded', info: parsed });
  });
  autoUpdater.on('error', (err: Error) => {
    const message = err?.message ?? 'Error al comprobar actualizaciones';
    updateRuntime({ status: 'error', error: message, progress: null });
    emit({ type: 'error', message });
  });
}

export function initUpdater(): void {
  if (initialized) return;
  initialized = true;
  if (!app.isPackaged) return;
  setupListeners();
  const config = readConfig();
  if (config.feedUrl) applyFeedUrl(config.feedUrl);
  if (config.autoCheck) {
    setTimeout(() => {
      void checkNow();
    }, STARTUP_CHECK_DELAY_MS);
  }
}

export function getUpdaterStatus(): UpdaterStatus {
  const config = readConfig();
  const enabled = app.isPackaged;
  return {
    enabled,
    disabledReason: enabled ? undefined : 'Solo disponible en la aplicación instalada.',
    currentVersion: app.getVersion(),
    feedUrl: config.feedUrl,
    autoCheck: config.autoCheck,
    state: runtime.status,
    info: runtime.info,
    progress: runtime.progress,
    error: runtime.error,
  };
}

export async function checkNow(): Promise<{ ok: boolean; reason?: string }> {
  if (!app.isPackaged) return { ok: false, reason: 'Las actualizaciones requieren la app instalada.' };
  if (runtime.checkingInFlight) {
    return { ok: false, reason: 'Ya hay una comprobación en curso.' };
  }
  runtime = { ...runtime, checkingInFlight: true, error: undefined };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    const message = (err as Error)?.message ?? 'No se pudo contactar el servidor de actualizaciones';
    updateRuntime({ status: 'error', error: message, progress: null });
    return { ok: false, reason: message };
  } finally {
    runtime = { ...runtime, checkingInFlight: false };
  }
}

export function installUpdate(): { ok: boolean; reason?: string } {
  if (!app.isPackaged) return { ok: false, reason: 'Las actualizaciones requieren la app instalada.' };
  if (runtime.status !== 'downloaded') {
    return { ok: false, reason: 'Aún no se ha descargado ninguna actualización.' };
  }
  stopLowStockWatcher();
  closeDatabase();
  for (const win of BrowserWindow.getAllWindows()) {
    win.destroy();
  }
  // Instalación en modo silencioso: cierra la app antes de lanzar el instalador
  // para que NSIS no detecte el proceso abierto ni bloquee el Uninstaller.
  autoUpdater.quitAndInstall(true, true);
  return { ok: true };
}

export function setUpdateConfig(input: UpdateConfigInput): { ok: boolean; reason?: string } {
  const feed = (input.feedUrl ?? '').trim();
  if (feed && !normalizeFeedUrl(feed)) {
    return { ok: false, reason: 'La URL del servidor de actualizaciones no es válida.' };
  }
  run(
    "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [FEED_KEY, feed],
  );
  run(
    "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [AUTO_CHECK_KEY, input.autoCheck ? '1' : '0'],
  );
  persist();
  if (app.isPackaged && feed) {
    applyFeedUrl(feed);
  }
  return { ok: true };
}