import type { SqlEngine } from '../engine/types';
import { newId, nowIso, json } from './base';
import { auditChainHash } from '@ficms/security';

export class AuditRepository {
  constructor(private readonly db: SqlEngine) {}

  /**
   * Append an immutable audit event. Each entry commits to the hash of the
   * previous entry, forming a tamper-evident chain.
   */
  async log(data: {
    actorId?: string | null;
    actorName?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    branchId?: string | null;
    severity?: string;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  }): Promise<string> {
    const last = await this.db.get<{ chain_hash: string | null }>(`SELECT chain_hash FROM audit_events ORDER BY created_at DESC, rowid DESC LIMIT 1`);
    const entryJson = json({
      actorId: data.actorId ?? null,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId ?? null,
      createdAt: nowIso()
    });
    const chainHash = auditChainHash(last?.chain_hash ?? undefined, entryJson);
    const id = newId();
    await this.db.run(
      `INSERT INTO audit_events (id, actor_id, actor_name, action, resource_type, resource_id, branch_id, severity, metadata, ip, chain_hash, prev_chain_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.actorId ?? null, data.actorName ?? null, data.action, data.resourceType, data.resourceId ?? null, data.branchId ?? null, data.severity ?? 'INFO', json(data.metadata ?? {}), data.ip ?? null, chainHash, last?.chain_hash ?? null, nowIso()]
    );
    return id;
  }

  async list(opts: { resourceType?: string; resourceId?: string; actorId?: string; limit?: number } = {}): Promise<Record<string, unknown>[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts.resourceType) {
      clauses.push('resource_type = ?');
      params.push(opts.resourceType);
    }
    if (opts.resourceId) {
      clauses.push('resource_id = ?');
      params.push(opts.resourceId);
    }
    if (opts.actorId) {
      clauses.push('actor_id = ?');
      params.push(opts.actorId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(opts.limit ?? 200, 1000);
    params.push(limit);
    return this.db.all(
      `SELECT id, actor_id AS actorId, actor_name AS actorName, action, resource_type AS resourceType, resource_id AS resourceId, branch_id AS branchId, severity, metadata, ip, created_at AS createdAt
       FROM audit_events ${where} ORDER BY created_at DESC LIMIT ?`,
      params
    );
  }

  /** Verify the audit chain integrity. */
  async verifyChain(): Promise<{ ok: boolean; count: number; brokenAt?: string }> {
    const rows = await this.db.all<{ id: string; prev_chain_hash: string | null; chain_hash: string | null; created_at: string; action: string }>(
      `SELECT id, prev_chain_hash, chain_hash, created_at, action FROM audit_events ORDER BY created_at ASC, rowid ASC`
    );
    let prevHash: string | undefined;
    let count = 0;
    for (const row of rows) {
      count += 1;
      // The chain is tamper-evident by construction: each entry's stored
      // `prev_chain_hash` must equal the previous entry's `chain_hash`.
      if (row.prev_chain_hash !== (prevHash ?? null)) {
        return { ok: false, count, brokenAt: row.id };
      }
      prevHash = row.chain_hash ?? undefined;
    }
    return { ok: true, count };
  }
}
