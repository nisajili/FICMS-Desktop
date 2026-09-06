import type { Result, WitnessStatus } from '@ficms/types';

export const IDENTITY_SENSITIVE_EVENTS = [
  'EGG_RETRIEVAL',
  'INSEMINATION',
  'FERTILIZATION_CHECK',
  'EMBRYO_TRANSFER',
  'EMBRYO_FREEZE',
  'EMBRYO_THAW',
  'SPERM_FREEZE',
  'SPERM_THAW',
  'SAMPLE_ALLOCATION',
  'CRYO_RELEASE',
  'CRYO_DISPOSAL'
] as const;

export type IdentitySensitiveEvent = (typeof IDENTITY_SENSITIVE_EVENTS)[number];

export function isIdentitySensitiveEvent(eventType: string): boolean {
  return (IDENTITY_SENSITIVE_EVENTS as readonly string[]).includes(eventType);
}

/**
 * Double-witness rule: an identity-sensitive event may only complete once it
 * has been verified by a second, *different* registered user.
 */
export function assertDoubleWitness(input: {
  primaryUserId: string;
  witnessUserId: string;
  status?: WitnessStatus;
}): Result<void> {
  if (!input.primaryUserId || !input.witnessUserId) {
    return { ok: false, error: { code: 'WITNESS_REQUIRED', message: 'Two distinct witnesses are required.' } };
  }
  if (input.primaryUserId === input.witnessUserId) {
    return { ok: false, error: { code: 'WITNESS_SAME_USER', message: 'The witness must be a different user.' } };
  }
  if (input.status && input.status !== 'VERIFIED') {
    return { ok: false, error: { code: 'WITNESS_NOT_VERIFIED', message: 'Verification has not been completed.' } };
  }
  return { ok: true, value: undefined };
}
