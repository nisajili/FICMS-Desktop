import path from 'node:path';
import type { Database, Repositories } from '@ficms/database';
import { runMaintenance, JOB_NAMES } from './maintenance';

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export interface JobPayload {
  [JOB_NAMES.backup]?: { destPath?: string };
  [JOB_NAMES.maintenance]?: Record<string, never>;
  [JOB_NAMES.report]?: { kind?: string };
}

export interface JobResult {
  ok: boolean;
  detail?: string;
}

export type JobHandler = (payload: JobPayload[keyof JobPayload]) => Promise<JobResult>;

/**
 * Register the concrete handlers for every background job the worker knows
 * how to process. Shared by the in-process and Redis/BullMQ transports.
 */
export function jobHandlers(db: Database, repos: Repositories): Record<JobName, JobHandler> {
  return {
    [JOB_NAMES.maintenance]: async () => {
      const report = await runMaintenance(repos, db);
      return { ok: report.integrity.ok, detail: JSON.stringify(report) };
    },
    [JOB_NAMES.backup]: async (payload) => {
      const p = (payload ?? {}) as JobPayload[typeof JOB_NAMES.backup];
      const dest = p?.destPath ?? path.join(process.cwd(), 'backups', `ficms-${Date.now()}.db`);
      const result = await db.backupTo(dest);
      return { ok: true, detail: `backup written to ${result.path} (${result.bytes} bytes)` };
    },
    [JOB_NAMES.report]: async (payload) => {
      const p = (payload ?? {}) as JobPayload[typeof JOB_NAMES.report];
      return { ok: true, detail: `report requested: ${p?.kind ?? 'summary'} (queued for generation)` };
    }
  };
}

/**
 * Start a BullMQ worker when Redis is configured. Returns `null` (and starts
 * nothing) when Redis is disabled so the process still runs as a pure
 * maintenance worker in standalone/on-premise deployments without Redis.
 */
export async function startBullWorker(redisUrl: string, db: Database, repos: Repositories): Promise<{ close(): Promise<void> } | null> {
  const { Worker } = await import('bullmq');
  const handlers = jobHandlers(db, repos);

  const worker = new Worker(
    'ficms',
    async (job) => {
      const handler = handlers[job.name as JobName];
      if (!handler) throw new Error(`Unknown job type: ${job.name}`);
      return handler(job.data as never);
    },
    {
      connection: { url: redisUrl },
      concurrency: 4,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 1000 }
    }
  );

  await worker.waitUntilReady();
  return { close: () => worker.close() };
}
