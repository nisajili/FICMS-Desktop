/**
 * Migration CLI (development convenience):
 *   pnpm db:migrate            -> apply pending migrations
 *   pnpm db:migrate:status     -> list migration status
 *
 * DATABASE_URL drives the engine; default is a local sql.js file.
 */
import { resolveSqlitePath } from '../db';
import { createSqliteEngine } from '../engine/sqlite';
import { appliedMigrations, migrate } from './runner';

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'migrate';
  const rawUrl = process.env.DATABASE_URL ?? 'file:./ficms.db';
  const filePath = resolveSqlitePath(rawUrl);
  const engine = await createSqliteEngine({ filePath });
  try {
    if (cmd === 'status') {
      const status = await appliedMigrations(engine);
      for (const s of status) {
        console.log(`${s.applied ? '✔' : '·'} ${s.id} ${s.name}${s.appliedAt ? ` (${s.appliedAt})` : ''}`);
      }
    } else {
      const result = await migrate(engine);
      console.log(result.applied.length ? `Applied migrations: ${result.applied.join(', ')}` : 'Already up to date.');
    }
  } finally {
    await engine.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
