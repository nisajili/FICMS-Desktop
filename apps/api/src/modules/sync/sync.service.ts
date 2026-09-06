import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';

/**
 * Offline synchronization service. Clients queue operations with idempotency
 * keys; the server applies them through the same transactional repositories,
 * so critical rules (payment idempotency, stock guards, witness checks) are
 * never bypassed. Version conflicts are recorded for authorized resolution.
 */
@Injectable()
export class SyncService {
  constructor(private readonly db: DatabaseService) {}

  async push(clientId: string, operations: {
    entityKind: string;
    entityId: string;
    operationType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }[]) {
    const results: { idempotencyKey: string; status: string; error?: string }[] = [];
    for (const op of operations) {
      try {
        const id = await this.db.repos.sync.enqueue({
          clientId,
          entityKind: op.entityKind,
          entityId: op.entityId,
          operationType: op.operationType,
          payload: op.payload,
          idempotencyKey: op.idempotencyKey
        });
        await this.db.repos.sync.markSyncing(id);
        await this.applyOperation(op);
        await this.db.repos.sync.markApplied(id);
        results.push({ idempotencyKey: op.idempotencyKey, status: 'APPLIED' });
      } catch (err) {
        results.push({ idempotencyKey: op.idempotencyKey, status: 'CONFLICT', error: (err as Error).message });
        await this.db.repos.sync.recordConflict({
          entityKind: op.entityKind,
          entityId: op.entityId,
          localVersion: 1,
          remoteVersion: 1,
          reason: (err as Error).message
        });
      }
    }
    await this.db.repos.sync.recordJournal(clientId, operations.length);
    return { results };
  }

  private async applyOperation(op: { entityKind: string; operationType: string; payload: Record<string, unknown> }): Promise<void> {
    // Only safe, idempotent-by-key operations are replayed server-side.
    switch (op.entityKind) {
      case 'payment': {
        const p = op.payload as { invoiceId: string; amountMinor: number; method: string; idempotencyKey: string; recordedById: string };
        await this.db.repos.finance.recordPayment({
          invoiceId: p.invoiceId,
          amountMinor: p.amountMinor,
          method: p.method,
          idempotencyKey: p.idempotencyKey,
          recordedById: p.recordedById
        });
        break;
      }
      case 'stock_movement': {
        const s = op.payload as { stockItemId: string; type: never; quantity: number; performedById: string; idempotencyKey: string };
        await this.db.repos.inventory.movement({
          stockItemId: s.stockItemId,
          type: s.type,
          quantity: s.quantity,
          performedById: s.performedById,
          idempotencyKey: s.idempotencyKey
        });
        break;
      }
      case 'appointment': {
        if (op.operationType === 'CREATE') {
          const a = op.payload as { patientId: string; title: string; startsAt: string; endsAt: string; clientRef: string };
          await this.db.repos.appointments.create({ ...a, clientRef: a.clientRef });
        }
        break;
      }
      default:
        throw new Error(`Unsupported entity kind for sync: ${op.entityKind}`);
    }
  }

  async conflicts() {
    return this.db.repos.sync.openConflicts();
  }

  async resolveConflict(id: string, resolution: 'RESOLVED_LOCAL' | 'RESOLVED_REMOTE') {
    await this.db.repos.sync.resolveConflict(id, resolution);
    return { ok: true };
  }

  async status() {
    const operations = await this.db.repos.sync.pending('*', 0);
    const conflicts = await this.db.repos.sync.openConflicts();
    return { queued: operations.length, openConflicts: conflicts.length };
  }
}
