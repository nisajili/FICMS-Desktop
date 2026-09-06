import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { SqlEngine, SqliteEngine } from './engine/types';
import { createSqliteEngine } from './engine/sqlite';
import { createPostgresEngine } from './engine/postgres';
import { migrate, integrityCheck } from './migrate/runner';

export interface DatabaseConnectionOptions {
  /** `file:...` for SQLite, `postgresql://...` for PostgreSQL. */
  url?: string;
  /** SQLite only: absolute path override (used by standalone backend). */
  sqlitePath?: string;
}

export interface Database {
  engine: SqlEngine;
  provider: 'sqlite' | 'postgresql';
  backupTo(destPath: string): Promise<{ path: string; bytes: number }>;
  integrity(): Promise<{ ok: boolean; detail?: string }>;
  close(): Promise<void>;
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Parse a `file:` URL (or bare path) into an absolute filesystem path. */
export function resolveSqlitePath(url: string): string {
  const raw = url.replace(/^file:/, '');
  if (raw === ':memory:') return ':memory:';
  return path.resolve(raw || './ficms.db');
}

function isPostgres(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

export async function openDatabase(options: DatabaseConnectionOptions = {}): Promise<Database> {
  const url = options.url ?? process.env.DATABASE_URL ?? 'file:./ficms.db';

  let engine: SqlEngine;
  let provider: 'sqlite' | 'postgresql';

  if (isPostgres(url)) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: url });
    engine = createPostgresEngine({ pool });
    provider = 'postgresql';
  } else {
    const filePath = options.sqlitePath ?? resolveSqlitePath(url);
    engine = await createSqliteEngine({ filePath });
    provider = 'sqlite';
  }

  await migrate(engine);

  return {
    engine,
    provider,
    async backupTo(destPath: string): Promise<{ path: string; bytes: number }> {
      if (engine.provider === 'sqlite') {
        const data = (engine as SqliteEngine).export();
        const tmp = `${destPath}.tmp-${process.pid}`;
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(tmp, Buffer.from(data));
        await fs.rename(tmp, destPath);
        return { path: destPath, bytes: data.length };
      }
      // PostgreSQL backups are the DBAs responsibility (pg_dump); export a marker.
      const marker = `${destPath}.pg.txt`;
      await fs.writeFile(marker, `FICMS PostgreSQL deployment. Use pg_dump for backups. ${new Date().toISOString()}\n`);
      return { path: marker, bytes: 0 };
    },
    async integrity(): Promise<{ ok: boolean; detail?: string }> {
      return integrityCheck(engine);
    },
    async close(): Promise<void> {
      await engine.close();
    }
  };
}
