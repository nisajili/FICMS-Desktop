import type { ID, ISODateTime } from './common';

export type SyncEntityKind = 'patient' | 'appointment' | 'consultation' | 'payment' | 'stock_movement' | 'laboratory';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncOperation {
  id: ID;
  clientId: string;
  entityKind: SyncEntityKind;
  entityId: ID;
  operationType: SyncOperationType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: 'QUEUED' | 'SYNCING' | 'APPLIED' | 'CONFLICT' | 'FAILED';
  attempts: number;
  lastError?: string;
  queuedAt: ISODateTime;
  appliedAt?: ISODateTime;
}

export interface SyncJournalEntry {
  id: ID;
  clientId: string;
  lastServerTimestamp: ISODateTime;
  pulledAt: ISODateTime;
  pushedCount: number;
}

export interface ConflictInfo {
  entityKind: SyncEntityKind;
  entityId: ID;
  localVersion: number;
  remoteVersion: number;
  reason: string;
}

export interface SyncSnapshot {
  operationsQueued: number;
  lastSyncAt?: ISODateTime;
  online: boolean;
}
