import { randomUUID } from 'node:crypto';

/** UUID v4 idempotency/client-generated identifiers. */
export function newUuid(): string {
  return randomUUID();
}
