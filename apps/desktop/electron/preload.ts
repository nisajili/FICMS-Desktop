import { contextBridge, ipcRenderer } from 'electron';

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
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('ficms:open-external', url)
};

contextBridge.exposeInMainWorld('ficms', bridge);
