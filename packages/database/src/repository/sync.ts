import type { SqlEngine } from '../engine/types';
import { newId, nowIso, json } from './base';

export class SyncRepository {
  constructor(private readonly db: SqlEngine) {}

  async enqueue(data: {
    clientId: string;
    entityKind: string;
    entityId: string;
    operationType: string;
    payload: object;
    idempotencyKey: string;
  }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO sync_operations (id, client_id, entity_kind, entity_id, operation_type, payload, idempotency_key, status, attempts, queued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', 0, ?)`,
      [id, data.clientId, data.entityKind, data.entityId, data.operationType, json(data.payload), data.idempotencyKey, nowIso()]
    );
    return id;
  }

  async pending(clientId: string, limit = 100): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT * FROM sync_operations WHERE client_id = ? AND status IN ('QUEUED','FAILED') ORDER BY queued_at LIMIT ?`,
      [clientId, limit]
    );
  }

  async markSyncing(id: string): Promise<void> {
    await this.db.run(`UPDATE sync_operations SET status = 'SYNCING', attempts = attempts + 1 WHERE id = ?`, [id]);
  }

  async markApplied(id: string): Promise<void> {
    await this.db.run(`UPDATE sync_operations SET status = 'APPLIED', applied_at = ? WHERE id = ?`, [nowIso(), id]);
  }

  async markConflict(id: string, reason: string): Promise<void> {
    await this.db.run(`UPDATE sync_operations SET status = 'CONFLICT', last_error = ? WHERE id = ?`, [reason, id]);
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db.run(`UPDATE sync_operations SET status = 'FAILED', last_error = ? WHERE id = ?`, [error, id]);
  }

  async recordJournal(clientId: string, pushedCount: number): Promise<void> {
    await this.db.run(
      `INSERT INTO sync_journal_entries (id, client_id, last_server_timestamp, pulled_at, pushed_count) VALUES (?, ?, ?, ?, ?)`,
      [newId(), clientId, nowIso(), nowIso(), pushedCount]
    );
  }

  async recordConflict(data: { entityKind: string; entityId: string; localVersion: number; remoteVersion: number; reason: string }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO conflict_records (id, entity_kind, entity_id, local_version, remote_version, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
      [id, data.entityKind, data.entityId, data.localVersion, data.remoteVersion, data.reason, nowIso()]
    );
    return id;
  }

  async openConflicts(): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM conflict_records WHERE status = 'OPEN' ORDER BY created_at DESC`);
  }

  async resolveConflict(id: string, resolution: 'RESOLVED_LOCAL' | 'RESOLVED_REMOTE'): Promise<void> {
    await this.db.run(`UPDATE conflict_records SET status = ? WHERE id = ?`, [resolution, id]);
  }
}
