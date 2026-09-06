import { promises as fs } from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import type { SqlEngine, SqliteEngine, SqliteFileOptions } from './types';

/**
 * SQLite engine backed by sql.js (WASM). No native binaries are required, so
 * this runs identically in Node.js and inside the Electron main process.
 *
 * Persistence model: the database lives in memory and is atomically written to
 * `filePath` (write-to-temp + rename) whenever a write transaction commits.
 * This gives crash-safety comparable to a journaled file while keeping a
 * dependency-free runtime.
 */

function normalizeParam(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

export async function createSqliteEngine(options: SqliteFileOptions): Promise<SqliteEngine> {
  const SQL = await initSqlJs();
  const filePath = options.filePath;
  let db: Database;
  let dirty = false;
  let txDepth = 0;

  if (filePath === ':memory:') {
    db = new SQL.Database();
  } else {
    let bytes: Uint8Array | null = null;
    try {
      bytes = await fs.readFile(filePath);
    } catch {
      /* fresh database */
    }
    db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');

  // sql.js's `Database#export()` (used to snapshot the database) resets
  // connection-level PRAGMAs such as `foreign_keys` back to their defaults.
  // Re-assert enforcement after every snapshot so foreign keys stay ON.
  const assertForeignKeys = (): void => {
    db.run('PRAGMA foreign_keys = ON;');
  };

  const persist = async (): Promise<void> => {
    if (filePath === ':memory:' || !dirty) return;
    const data = db.export();
    assertForeignKeys();
    const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tmp, Buffer.from(data));
    await fs.rename(tmp, filePath);
    dirty = false;
    options.onPersist?.(data.length);
  };

  const engine: SqliteEngine = {
    provider: 'sqlite',
    filePath,

    async exec(sql: string): Promise<void> {
      db.run(sql);
      dirty = true;
      if (txDepth === 0) await persist();
    },

    async all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params.map(normalizeParam) as never);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },

    async get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      const rows = await engine.all<T>(sql, params);
      return rows[0];
    },

    async run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertId?: string | number }> {
      db.run(sql, params.map(normalizeParam) as never);
      dirty = true;
      const changes = db.getRowsModified();
      const lastInsertId = (db as unknown as { exec: (s: string) => void }) && readLastInsertId(db);
      if (txDepth === 0) await persist();
      return { changes, lastInsertId };
    },

    async transaction<T>(fn: (tx: SqlEngine) => Promise<T>): Promise<T> {
      if (txDepth > 0) {
        txDepth += 1;
        try {
          return await fn(engine);
        } finally {
          txDepth -= 1;
        }
      }
      txDepth = 1;
      assertForeignKeys();
      db.run('BEGIN;');
      try {
        const result = await fn(engine);
        db.run('COMMIT;');
        dirty = true;
        await persist();
        return result;
      } catch (err) {
        try {
          db.run('ROLLBACK;');
        } catch {
          /* ignore rollback errors */
        }
        throw err;
      } finally {
        txDepth = 0;
      }
    },

    export(): Uint8Array {
      const data = db.export();
      assertForeignKeys();
      return data;
    },

    async flush(): Promise<void> {
      dirty = true;
      await persist();
    },

    async close(): Promise<void> {
      await persist();
      db.close();
    }
  };

  return engine;
}

function readLastInsertId(db: Database): number {
  const rows = db.exec('SELECT last_insert_rowid() AS id');
  if (rows.length && rows[0]!.values.length) {
    return Number(rows[0]!.values[0]![0]);
  }
  return 0;
}
