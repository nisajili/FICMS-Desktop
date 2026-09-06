import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { resolveMode, startStandaloneBackend, stopBackend, type RuntimeConfig } from './backend';

let mainWindow: BrowserWindow | null = null;
let backendChild: ChildProcess | null = null;
let runtimeConfig: RuntimeConfig | null = null;

/** Single-instance lock: focus the existing window instead of opening twice. */
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

// --- OS credential vault (safeStorage) -----------------------------------

function vaultPath(): string {
  return path.join(app.getPath('userData'), 'secure', 'vault.bin');
}

interface VaultEntry {
  [key: string]: string;
}

function readVault(): VaultEntry {
  try {
    const raw = fs.readFileSync(vaultPath(), 'utf8');
    return JSON.parse(raw) as VaultEntry;
  } catch {
    return {};
  }
}

function writeVault(entries: VaultEntry): void {
  fs.mkdirSync(path.dirname(vaultPath()), { recursive: true });
  fs.writeFileSync(vaultPath(), JSON.stringify(entries), { mode: 0o600 });
}

function registerIpcHandlers(): void {
  ipcMain.handle('ficms:runtime-config', () => runtimeConfig);

  // Tokens are stored encrypted with the OS keychain (never plaintext). When
  // the OS vault is unavailable the value is kept in memory only.
  ipcMain.handle('ficms:keychain-set', (_event, key: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) return;
    const entries = readVault();
    entries[key] = safeStorage.encryptString(value).toString('base64');
    writeVault(entries);
  });

  ipcMain.handle('ficms:keychain-get', (_event, key: string): string | null => {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const stored = readVault()[key];
    if (!stored) return null;
    try {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('ficms:keychain-delete', (_event, key: string) => {
    const entries = readVault();
    delete entries[key];
    writeVault(entries);
  });

  ipcMain.handle('ficms:open-external', (_event, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        void shell.openExternal(parsed.toString());
      }
    } catch {
      /* ignore invalid URLs */
    }
  });
}

// --- Window ---------------------------------------------------------------

function createWindow(devUrl?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'FICMS',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });

  // Never allow the renderer to spawn new windows; hand http(s) to the OS.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') void shell.openExternal(parsed.toString());
    } catch {
      /* ignore */
    }
    return { action: 'deny' };
  });

  // Keep the app on its own UI; block navigation to arbitrary origins.
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  if (app.isPackaged) {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return win;
}

// --- Bootstrap ------------------------------------------------------------

async function bootstrap(): Promise<void> {
  registerIpcHandlers();

  const mode = resolveMode();
  let apiBaseUrl: string;

  if (mode === 'standalone') {
    const { baseUrl, child } = await startStandaloneBackend();
    backendChild = child;
    apiBaseUrl = baseUrl;
  } else {
    apiBaseUrl = process.env.FICMS_DESKTOP_BACKEND_URL ?? 'http://127.0.0.1:4123/api/v1';
  }

  runtimeConfig = {
    mode,
    apiBaseUrl,
    platform: process.platform,
    versions: {
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? ''
    }
  };

  mainWindow = createWindow(process.env.FICMS_DEV_SERVER_URL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  // Restrict permission requests (camera, notifications, geolocation…).
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  await bootstrap();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(process.env.FICMS_DEV_SERVER_URL);
      mainWindow.on('closed', () => {
        mainWindow = null;
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend(backendChild);
  backendChild = null;
});
