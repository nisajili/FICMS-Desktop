import type { Database, Repositories } from '@ficms/database';

export interface MaintenanceReport {
  purgedSessions: number;
  integrity: { ok: boolean; detail?: string };
}

/**
 * Background maintenance jobs that must run regardless of whether Redis is
 * available. Pure database work, safe to run concurrently with the API:
 *  - purge expired/revoked sessions,
 *  - verify SQLite integrity (`PRAGMA integrity_check`).
 */
export async function runMaintenance(repos: Repositories, db: Database): Promise<MaintenanceReport> {
  const purgedSessions = await repos.sessions.purgeExpired();
  const integrity = await db.integrity();
  return { purgedSessions, integrity };
}

/** Define the names of the background jobs this worker can process. */
export const JOB_NAMES = {
  maintenance: 'maintenance.run',
  backup: 'backup.run',
  report: 'reports.generate'
} as const;
