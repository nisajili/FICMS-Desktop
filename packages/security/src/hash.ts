import { createHash } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Chained hash for the immutable audit log (each entry commits to the previous). */
export function auditChainHash(previousHash: string | undefined, entryJson: string): string {
  return sha256Hex(`${previousHash ?? 'GENESIS'}\n${entryJson}`);
}

/** Redact obvious sensitive values from diagnostic/crash text. */
export function redactSensitive(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]')
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[card]')
    .replace(/(password|token|secret|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[jwt]');
}
