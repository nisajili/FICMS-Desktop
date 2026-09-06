import { app } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';

export type DesktopMode = 'standalone' | 'lan' | 'connected';

export interface RuntimeConfig {
  mode: DesktopMode;
  /** Absolute backend base URL, including the versioned prefix. */
  apiBaseUrl: string;
  platform: NodeJS.Platform;
  versions: { electron: string; chrome: string; node: string };
}

/** Resolve the configured operating mode from the environment. */
export function resolveMode(): DesktopMode {
  const explicit = process.env.FICMS_DESKTOP_MODE;
  if (explicit === 'lan' || explicit === 'connected' || explicit === 'standalone') return explicit;
  // An explicit backend URL means the app talks to a remote server.
  if (process.env.FICMS_DESKTOP_BACKEND_URL) return 'lan';
  return 'standalone';
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      if (address && typeof address === 'object') {
        const { port } = address;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('Could not reserve a loopback port.')));
      }
    });
  });
}

/** Locate the compiled FICMS API entrypoint (dev workspace or packaged resources). */
function locateApiEntry(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'main.js');
  }
  return path.resolve(__dirname, '..', '..', 'api', 'dist', 'main.js');
}

/** Read-or-create a per-install secret used to sign the standalone token. */
function ensureAppSecret(dataDir: string): string {
  const secretPath = path.join(dataDir, 'app-secret');
  try {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing) return existing;
  } catch {
    /* first boot */
  }
  const secret = crypto.randomBytes(32).toString('base64');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(secretPath, secret, { mode: 0o600 });
  return secret;
}

/** Poll the backend readiness endpoint until it responds (or timeout). */
function waitForReady(baseUrl: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(`${baseUrl}/health/ready`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error('Embedded backend did not become ready in time.'));
      setTimeout(ping, 250);
    };
    ping();
  });
}

/**
 * Start the embedded backend for standalone mode. The API is bound to the
 * loopback interface (127.0.0.1) on an ephemeral port and seeded on first run,
 * so no unauthenticated local service is exposed beyond this machine.
 */
export async function startStandaloneBackend(): Promise<{ baseUrl: string; child: ChildProcess }> {
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const port = await freePort();
  const apiEntry = locateApiEntry();
  if (!fs.existsSync(apiEntry)) {
    throw new Error(
      `Embedded FICMS backend not found at ${apiEntry}. Build @ficms/api (pnpm --filter @ficms/api build) before launching standalone mode.`
    );
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    FICMS_STANDALONE: 'true',
    FICMS_STANDALONE_DATA_DIR: dataDir,
    FICMS_STANDALONE_BACKUP_DIR: path.join(app.getPath('userData'), 'backups'),
    FICMS_HOST: '127.0.0.1',
    FICMS_PORT: String(port),
    FICMS_CORS_ORIGIN: `http://127.0.0.1:${port}`,
    FICMS_APP_SECRET: ensureAppSecret(path.join(app.getPath('userData'), 'secure')),
    DATABASE_URL: `file:${path.join(dataDir, 'ficms.db')}`,
    FICMS_STORAGE_DRIVER: 'local',
    FICMS_STORAGE_LOCAL_ROOT: path.join(dataDir, 'storage'),
    // Standalone runs without Redis; the queue falls back to in-memory.
    FICMS_REDIS_ENABLED: 'false',
    FICMS_QUEUE_ENABLED: 'true'
  };

  const child = fork(apiEntry, [], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));

  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  await waitForReady(baseUrl);
  return { baseUrl, child };
}

/** Stop the embedded backend child process (idempotent). */
export function stopBackend(child: ChildProcess | null): void {
  if (!child) return;
  try {
    child.kill('SIGTERM');
  } catch {
    /* already gone */
  }
}
