import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import bcrypt from 'bcryptjs';
import { initDatabase, seedDefaultAdmin } from './database';
import { registerIpcHandlers } from './ipc-handlers';
import { refreshTrialWatermark } from './license';
import { initUpdater } from './updater';
import { startLowStockWatcher } from './notifications';
import { initGlobalErrorLogging } from './logger';

let mainWindow: BrowserWindow | null = null;

if (process.env.WAREHOS_USER_DATA) {
  app.setPath('userData', process.env.WAREHOS_USER_DATA);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'WarehOS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (gotSingleInstanceLock) {
  initGlobalErrorLogging();
  app.whenReady().then(async () => {
    await initDatabase();
    const defaultPassword = 'admin123';
    seedDefaultAdmin(
      bcrypt.hashSync(defaultPassword, 10),
      'admin',
      'Administrador',
    );
    refreshTrialWatermark();
    registerIpcHandlers(ipcMain);
    createWindow();
    initUpdater();
    startLowStockWatcher();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}