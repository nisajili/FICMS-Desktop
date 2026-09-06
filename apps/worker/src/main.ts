import { loadConfigFromEnv } from '@ficms/config';
import { openDatabase, Repositories } from '@ficms/database';
import { runMaintenance } from './maintenance';
import { startBullWorker } from './queue';

/**
 * FICMS background worker.
 *
 * - Always runs periodic database maintenance (session purge, integrity check).
 * - When `FICMS_REDIS_ENABLED=true` it additionally registers a BullMQ worker
 *   for report generation, backups and maintenance jobs.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfigFromEnv();
  const db = await openDatabase({ url: config.database.url });
  const repos = new Repositories(db.engine);

  const intervalMs = Number(process.env.FICMS_WORKER_INTERVAL_MS ?? 60_000);

  const tick = async (): Promise<void> => {
    try {
      const report = await runMaintenance(repos, db);
      // eslint-disable-next-line no-console
      console.log(`[FICMS worker] maintenance ok=${report.integrity.ok} purgedSessions=${report.purgedSessions}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[FICMS worker] maintenance failed', err);
    }
  };

  await tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();

  let redisWorker: { close(): Promise<void> } | null = null;
  if (config.redis.enabled) {
    redisWorker = await startBullWorker(config.redis.url, db, repos);
    // eslint-disable-next-line no-console
    console.log(`[FICMS worker] BullMQ worker connected to ${config.redis.url}`);
  } else {
    // eslint-disable-next-line no-console
    console.log('[FICMS worker] Redis disabled; running maintenance-only (in-process fallback).');
  }

  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await redisWorker?.close().catch(() => undefined);
    await db.close();
  };
  process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));
}

if (typeof require !== 'undefined' && require.main === module) {
  bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start FICMS worker', err);
    process.exit(1);
  });
}
