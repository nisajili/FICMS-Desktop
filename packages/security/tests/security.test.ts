import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  passwordMeetsPolicy,
  hashOpaqueToken,
  generateTotpSecret,
  totpUri,
  totpCode,
  verifyTotp,
  generateRecoveryCodes,
  generateInternalToken,
  verifyInternalToken,
  createCipherContext,
  deriveKey,
  sha256Hex,
  auditChainHash,
  redactSensitive
} from '../src/index.js';

describe('Argon2id passwords', () => {
  it('hashes and verifies', async () => {
    const h = await hashPassword('S3cure!Password');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(h, 'S3cure!Password')).toBe(true);
    expect(await verifyPassword(h, 'wrong')).toBe(false);
  });
  it('enforces policy', () => {
    expect(passwordMeetsPolicy('abc').ok).toBe(false);
    expect(passwordMeetsPolicy('Abcdef1234').ok).toBe(true);
  });
});

describe('TOTP', () => {
  it('generates valid secret and URI', () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(20);
    const uri = totpUri(secret, 'admin', 'FICMS');
    expect(uri).toContain('otpauth://totp/');
  });
  it('verifies current code', () => {
    const secret = generateTotpSecret();
    const code = totpCode(secret);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
  });
});

describe('Internal tokens', () => {
  it('signs and verifies a short-lived token', () => {
    const secret = 'test-secret';
    const token = generateInternalToken(secret, 60);
    expect(verifyInternalToken(token, secret).ok).toBe(true);
    expect(verifyInternalToken(token, 'other').ok).toBe(false);
    expect(verifyInternalToken(token + 'x', secret).ok).toBe(false);
  });
});

describe('Field cipher', () => {
  it('round-trips encryption', () => {
    const key = deriveKey(Buffer.from('master-secret'), Buffer.from('salt'));
    const ctx = createCipherContext(key);
    const enc = ctx.encrypt('patient-secret-data');
    expect(enc.ciphertext).not.toContain('patient-secret-data');
    expect(ctx.decrypt(enc)).toBe('patient-secret-data');
  });
});

describe('Hashing & redaction', () => {
  it('chains audit hashes', () => {
    const h1 = auditChainHash(undefined, '{"a":1}');
    const h2 = auditChainHash(h1, '{"a":2}');
    expect(h1).not.toBe(h2);
    expect(sha256Hex('x')).toHaveLength(64);
  });
  it('redacts sensitive values', () => {
    const out = redactSensitive('email a@b.com, token=secret123, card 4111 1111 1111 1111');
    expect(out).not.toContain('a@b.com');
    expect(out).not.toContain('secret123');
    expect(out).not.toContain('4111');
    expect(out).toContain('[email]');
  });
  it('hashes opaque tokens', () => {
    expect(hashOpaqueToken('tok')).toHaveLength(64);
  });
  it('generates recovery codes', () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });
});
