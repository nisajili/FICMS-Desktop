export {};

export interface FicmsUpdateStatus {
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
 * Runtime bridge exposed by the Electron preload script. Absent in the plain
 * browser preview, where the UI degrades to relative `/api` URLs and keeps
 * the session token in memory only.
 */
declare global {
  interface Window {
    ficms?: {
      runtime(): Promise<{
        mode: 'standalone' | 'lan' | 'connected';
        apiBaseUrl: string;
        platform: string;
        versions: { electron: string; chrome: string; node: string };
      }>;
      keychain?: {
        set(key: string, value: string): Promise<void>;
        get(key: string): Promise<string | null>;
        delete(key: string): Promise<void>;
      };
      openExternal?(url: string): Promise<void>;
      updater?: {
        enabled(): Promise<boolean>;
        status(): Promise<FicmsUpdateStatus>;
        check(): Promise<void>;
        download(): Promise<void>;
        install(): Promise<void>;
        onStatus(callback: (status: FicmsUpdateStatus) => void): () => void;
      };
    };
  }
}
