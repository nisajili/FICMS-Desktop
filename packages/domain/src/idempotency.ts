/** Create an idempotency key to de-duplicate non-idempotent operations. */
export function newIdempotencyKey(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // Fallback for environments without Web Crypto (non-cryptographic).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Replay-protection window helper. Callers persist the key with the operation;
 * when the same key reappears the operation must be treated as already-applied
 * and the stored result returned instead of re-executing.
 */
export function idempotencyScope(resource: string, action: string): string {
  return `${resource}:${action}`;
}
