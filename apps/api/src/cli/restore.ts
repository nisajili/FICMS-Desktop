/**
 * Restore CLI (run with the API stopped):
 *   pnpm --filter @ficms/api restore <backup.db>
 *
 * Safety behaviour (aligned with "never overwrite/delete clinic data"):
 *  1. The backup is opened read-only and must pass `PRAGMA integrity_check`.
 *  2. The live database is snapshotted to `<live>.pre-restore-<ts>` first.
 *  3. The backup is copied into place atomically (write-to-temp + rename).
 *
 * PostgreSQL restores are delegated to pg_restore and refused here.
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createSqliteEngine, resolveSqlitePath } from '@ficms/database';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'file:./ficms.db';
  const src = process.argv[2];

  if (!src) {
    // eslint-disable-next-line no-console
    console.error('Usage: restore <backup.db>');
    process.exitCode = 2;
    return;
  }
  if (!url.startsWith('file:')) {
    // eslint-disable-next-line no-console
    console.error('Automatic restore is only supported for SQLite (file: URLs). For PostgreSQL, use pg_restore with a point-in-time recovery plan.');
    process.exitCode = 2;
    return;
  }

  const backupPath = path.resolve(src);

  // 1. Validate the backup without migrating or mutating it.
  const engine = await createSqliteEngine({ filePath: backupPath });
  let integrityOk = false;
  let detail = '';
  try {
    const rows = await engine.all<{ integrity_check: string }>('PRAGMA integrity_check;');
    const result = rows.map((r) => r.integrity_check).join('\n');
    integrityOk = result === 'ok';
    detail = result;
  } catch (err) {
    detail = (err as Error).message;
  } finally {
    await engine.close();
  }
  if (!integrityOk) {
    // eslint-disable-next-line no-console
    console.error(`Refusing to restore: backup failed integrity check (${detail})`);
    process.exitCode = 1;
    return;
  }

  // 2. Snapshot the live database before overwriting.
  const livePath = resolveSqlitePath(url);
  try {
    const existing = await fs.stat(livePath);
    if (existing.size > 0) {
      const snapshot = `${livePath}.pre-restore-${Date.now()}`;
      await fs.copyFile(livePath, snapshot);
      // eslint-disable-next-line no-console
      console.log(`Pre-restore snapshot: ${snapshot}`);
    }
  } catch {
    /* no live database yet */
  }

  // 3. Atomically copy the backup into place.
  const backupBytes = await fs.readFile(backupPath);
  const tmp = `${livePath}.tmp-${process.pid}`;
  await fs.mkdir(path.dirname(livePath), { recursive: true });
  await fs.writeFile(tmp, backupBytes);
  await fs.rename(tmp, livePath);

  // eslint-disable-next-line no-console
  console.log(`Restored ${livePath} from ${backupPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Restore failed:', err);
  process.exitCode = 1;
});
