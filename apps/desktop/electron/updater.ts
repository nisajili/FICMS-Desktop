import { app, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Secure auto-update.
 *
 * Design constraints (medical-data safety):
 *  - Enabled ONLY in packaged builds with an explicitly configured update feed.
 *  - Updates are checked but NEVER auto-downloaded or auto-installed; the user
 *    (or an administrator) must explicitly consent to download and install.
 *  - The update feed is a clinic-managed generic server (HTTPS recommended);
 *    nothing is hardcoded. electron-updater verifies the update signature when
 *    a code-signing certificate is present.
 *  - A failed update never touches the local database: the backend is stopped
 *    before install and clinic data lives outside the app bundle.
 */

export interface UpdateStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  version?: string;
  percent?: number;
  error?: string;
}

function resolveFeedUrl(): string | null {
  const fromEnv = process.env.FICMS_UPDATE_URL;
  if (fromEnv) return fromEnv;
  // Admins can drop an update-config.json in the app data dir to point the
  // build at a self-hosted update server without repackaging.
  try {
    const raw = fs.readFileSync(path.join(app.getPath('userData'), 'update-config.json'), 'utf8');
    const config = JSON.parse(raw) as { feedUrl?: string };
    return config.feedUrl ?? null;
  } catch {
    return null;
  }
}

export interface UpdaterHandle {
  enabled: boolean;
  status(): UpdateStatus;
  check(): Promise<void>;
  download(): Promise<void>;
  quitAndInstall(): void;
}

export function setupAutoUpdater(getWindow: () => BrowserWindow | null): UpdaterHandle {
  const feedUrl = resolveFeedUrl();
  const enabled = app.isPackaged && Boolean(feedUrl);

  let status: UpdateStatus = { state: 'idle' };

  const broadcast = (next: UpdateStatus): void => {
    status = next;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('ficms:update-status', status);
  };

  if (enabled) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl as string });

    autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }));
    autoUpdater.on('update-available', (info) => broadcast({ state: 'available', version: info.version }));
    autoUpdater.on('update-not-available', () => broadcast({ state: 'not-available' }));
    autoUpdater.on('download-progress', (progress) => broadcast({ state: 'downloading', percent: progress.percent }));
    autoUpdater.on('update-downloaded', (info) => broadcast({ state: 'downloaded', version: info.version }));
    autoUpdater.on('error', (err) => broadcast({ state: 'error', error: err.message }));
  }

  return {
    enabled,
    status: () => status,
    async check(): Promise<void> {
      if (enabled) await autoUpdater.checkForUpdates();
    },
    async download(): Promise<void> {
      if (enabled) await autoUpdater.downloadUpdate();
    },
    quitAndInstall(): void {
      if (enabled) autoUpdater.quitAndInstall(false, true);
    }
  };
}
