import { contextBridge, ipcRenderer } from 'electron';

/** Auto-update status pushed by the main process. */
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

/**
 * The only bridge between the sandboxed renderer and the main process.
 * Everything the UI can do is an explicit, allow-listed function; the
 * renderer never gets Node.js or ipcRenderer directly.
 */
const bridge = {
  runtime: () => ipcRenderer.invoke('ficms:runtime-config'),
  keychain: {
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('ficms:keychain-set', key, value),
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('ficms:keychain-get', key),
    delete: (key: string): Promise<void> => ipcRenderer.invoke('ficms:keychain-delete', key)
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('ficms:open-external', url),
  updater: {
    enabled: (): Promise<boolean> => ipcRenderer.invoke('ficms:update-enabled'),
    status: (): Promise<UpdateStatus> => ipcRenderer.invoke('ficms:update-status'),
    check: (): Promise<void> => ipcRenderer.invoke('ficms:update-check'),
    download: (): Promise<void> => ipcRenderer.invoke('ficms:update-download'),
    install: (): Promise<void> => ipcRenderer.invoke('ficms:update-install'),
    onStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void => callback(status);
      ipcRenderer.on('ficms:update-status', listener);
      return () => ipcRenderer.removeListener('ficms:update-status', listener);
    }
  }
};

contextBridge.exposeInMainWorld('ficms', bridge);
