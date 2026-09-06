import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSqliteEngine } from '../src/engine/sqlite';
import { migrate, integrityCheck } from '../src/migrate/runner';
import type { SqliteEngine } from '../src/engine/types';

describe('SQLite engine (WASM)', () => {
  let engine: SqliteEngine;

  beforeEach(async () => {
    engine = await createSqliteEngine({ filePath: ':memory:' });
  });

  it('runs parameterized queries', async () => {
    await engine.exec(`CREATE TABLE t (id TEXT, n INTEGER)`);
    await engine.run(`INSERT INTO t (id, n) VALUES (?, ?)`, ['a', 1]);
    const rows = await engine.all(`SELECT * FROM t WHERE n > ?`, [0]);
    expect(rows).toHaveLength(1);
  });

  it('rolls back on transaction error', async () => {
    await engine.exec(`CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)`);
    await engine.run(`INSERT INTO t (id, n) VALUES ('a', 1)`, []);
    await expect(
      engine.transaction(async (tx) => {
        await tx.run(`INSERT INTO t (id, n) VALUES ('b', 2)`, []);
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    const rows = await engine.all(`SELECT * FROM t`);
    expect(rows).toHaveLength(1);
  });

  it('persists to disk and survives reopen', async () => {
    const file = path.join(os.tmpdir(), `ficms-test-${Date.now()}.db`);
    try {
      const db = await createSqliteEngine({ filePath: file });
      await migrate(db);
      await db.run(`INSERT INTO patients (id, mrn, first_name, last_name, name_key, sex, status, created_at, updated_at) VALUES ('p1', 'MRN-1', 'A', 'B', 'a|b', 'FEMALE', 'ACTIVE', '2026-01-01', '2026-01-01')`);
      await db.close();

      const reopened = await createSqliteEngine({ filePath: file });
      const rows = await reopened.all(`SELECT mrn FROM patients WHERE id = 'p1'`);
      expect(rows).toHaveLength(1);
      await reopened.close();
    } finally {
      await fs.rm(file, { force: true });
    }
  });

  it('passes integrity check after migration', async () => {
    await migrate(engine);
    const result = await integrityCheck(engine);
    expect(result.ok).toBe(true);
  });

  it('enforces foreign keys even after persistence snapshots', async () => {
    // Regression guard: sql.js `export()` resets connection PRAGMAs, which
    // previously disabled `foreign_keys` after the first write to disk.
    const file = path.join(os.tmpdir(), `ficms-fk-${Date.now()}.db`);
    try {
      const db = await createSqliteEngine({ filePath: file });
      await db.exec(`CREATE TABLE parent (id TEXT PRIMARY KEY)`);
      await db.exec(`CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, FOREIGN KEY (parent_id) REFERENCES parent(id))`);
      await db.run(`INSERT INTO parent (id) VALUES ('p1')`);
      await db.run(`INSERT INTO child (id, parent_id) VALUES ('c1', 'p1')`);
      await expect(db.run(`INSERT INTO child (id, parent_id) VALUES ('c2', 'missing')`)).rejects.toThrow(/FOREIGN KEY/i);
      await db.close();
    } finally {
      await fs.rm(file, { force: true });
    }
  });
});
