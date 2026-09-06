export {};

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
    };
  }
}
