import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type LoginResponse, type PublicUser } from './api';

/**
 * Session handling. The access token lives in memory only; when the Electron
 * keychain bridge is available and "remember me" is selected it is persisted
 * encrypted with the OS credential vault (never localStorage).
 */

const SESSION_KEY = 'ficms.session.token';

interface AuthState {
  token: string | null;
  user: PublicUser | null;
  mode: 'standalone' | 'lan' | 'connected' | 'preview';
  loading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<LoginResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [mode, setMode] = useState<AuthState['mode']>('preview');
  const [loading, setLoading] = useState(true);

  // Discover the runtime mode and restore a remembered session on boot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const runtime = window.ficms?.runtime;
        if (runtime) {
          const cfg = await runtime();
          if (!cancelled) setMode(cfg.mode);
        }
      } catch {
        /* preview */
      }

      try {
        const remembered = await window.ficms?.keychain?.get(SESSION_KEY);
        if (remembered && !cancelled) {
          const me = await api.me(remembered);
          if (!cancelled) {
            setToken(remembered);
            setUser(me);
          }
        }
      } catch {
        /* invalid/expired token: stay logged out */
        await window.ficms?.keychain?.delete(SESSION_KEY).catch(() => undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    const res = await api.login(username, password);
    setToken(res.accessToken);
    setUser(res.user);
    if (remember) {
      await window.ficms?.keychain?.set(SESSION_KEY, res.accessToken).catch(() => undefined);
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) await api.logout(token);
    } catch {
      /* ignore network errors on logout */
    }
    await window.ficms?.keychain?.delete(SESSION_KEY).catch(() => undefined);
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(
    () => ({ token, user, mode, loading, login, logout }),
    [token, user, mode, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
