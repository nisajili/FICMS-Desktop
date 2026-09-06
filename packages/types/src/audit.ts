import type { ID, ISODateTime } from './common';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditEvent {
  id: ID;
  actorId: string;
  actorName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  branchId?: string | null;
  severity: AuditSeverity;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: ISODateTime;
}

/** Audit records are immutable; an attempted tamper check compares chained hashes. */
export interface AuditChainState {
  lastHash?: string;
  count: number;
}
