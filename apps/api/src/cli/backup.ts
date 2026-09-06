/**
 * Backup CLI (run with the API stopped, or against a live SQLite file):
 *   pnpm --filter @ficms/api backup [dest.db]
 *
 * - SQLite:  a consistent, atomic snapshot (sql.js export) written to `dest`.
 * - PostgreSQL: writes a pg_dump guidance marker (DBA-managed backups).
 */
import path from 'node:path';
import { openDatabase } from '@ficms/database';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'file:./ficms.db';
  const dest = process.argv[2] ?? path.join(process.cwd(), 'backups', `ficms-${Date.now()}.db`);

  const db = await openDatabase({ url });
  try {
    const result = await db.backupTo(path.resolve(dest));
    // eslint-disable-next-line no-console
    console.log(`Backup written to ${result.path} (${result.bytes} bytes)`);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Backup failed:', err);
  process.exitCode = 1;
});
