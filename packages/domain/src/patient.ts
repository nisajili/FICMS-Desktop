import type { Result } from '@ficms/types';

const AGE_MAX_YEARS = 120;
const AGE_MIN_YEARS = 0;

/** Minimal validation shared by client and server for patient registration. */
export function assertValidDateOfBirth(dateOfBirth?: string | null): Result<void> {
  if (!dateOfBirth) return { ok: true, value: undefined };
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: { code: 'INVALID_DOB', message: 'Date of birth is invalid.' } };
  }
  if (d.getTime() > Date.now()) {
    return { ok: false, error: { code: 'FUTURE_DOB', message: 'Date of birth cannot be in the future.' } };
  }
  const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age > AGE_MAX_YEARS || age < AGE_MIN_YEARS) {
    return { ok: false, error: { code: 'IMPLAUSIBLE_DOB', message: 'Date of birth is outside a plausible range.' } };
  }
  return { ok: true, value: undefined };
}

/**
 * Normalize names for duplicate detection: lowercase, strip punctuation and
 * diacritics, then produce a stable key for fuzzy matching.
 */
export function nameKey(firstName?: string, lastName?: string): string {
  const normalize = (s?: string) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  return `${normalize(firstName)}|${normalize(lastName)}`;
}

export function looksLikeDuplicate(a: { nameKey: string; phone?: string | null }, b: { nameKey: string; phone?: string | null }): boolean {
  if (a.nameKey === b.nameKey) return true;
  if (a.phone && b.phone && a.phone.replace(/\D/g, '') === b.phone.replace(/\D/g, '')) return true;
  return false;
}
