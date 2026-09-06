import type { SqlEngine } from '../engine/types';
import { MIGRATIONS } from './migrations';

const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureTable(engine: SqlEngine): Promise<void> {
  await engine.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);`
  );
}

export interface MigrationStatus {
  id: number;
  name: string;
  applied: boolean;
  appliedAt?: string;
}

export async function appliedMigrations(engine: SqlEngine): Promise<MigrationStatus[]> {
  await ensureTable(engine);
  const rows = await engine.all<{ id: number; applied_at: string }>(
    `SELECT id, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY id`
  );
  const applied = new Map(rows.map((r) => [Number(r.id), r.applied_at]));
  return MIGRATIONS.map((m) => ({
    id: m.id,
    name: m.name,
    applied: applied.has(m.id),
    appliedAt: applied.get(m.id)
  }));
}

export async function migrate(engine: SqlEngine): Promise<{ applied: number[] }> {
  await ensureTable(engine);
  const status = await appliedMigrations(engine);
  const pending = MIGRATIONS.filter((m) => !status.find((s) => s.id === m.id)?.applied);
  const applied: number[] = [];

  for (const migration of pending) {
    await engine.transaction(async (tx) => {
      await tx.exec(migration.up);
      await tx.run(`INSERT INTO ${MIGRATIONS_TABLE} (id, name, applied_at) VALUES (?, ?, ?)`, [
        migration.id,
        migration.name,
        new Date().toISOString()
      ]);
    });
    applied.push(migration.id);
  }
  return { applied };
}

/** Verify the schema is healthy. SQLite-only; no-op for PostgreSQL. */
export async function integrityCheck(engine: SqlEngine): Promise<{ ok: boolean; detail?: string }> {
  if (engine.provider !== 'sqlite') return { ok: true };
  try {
    const rows = await engine.all<{ integrity_check: string }>('PRAGMA integrity_check;');
    const result = rows.map((r) => r.integrity_check).join('\n');
    return { ok: result === 'ok', detail: result };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}
