import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { argon2id } from '@noble/hashes/argon2';

/**
 * Argon2id password hashing (RFC 9106) via the audited, pure-JS @noble/hashes
 * implementation. This avoids native binaries so password hashing works
 * identically in Node.js, the Electron main process and the renderer-less
 * backend. Hashes are stored in PHC string format.
 */

const ARGON2_OPTIONS = {
  memoryKiB: 64 * 1024, // 64 MiB
  iterations: 3,
  parallelism: 1,
  hashLength: 32
} as const;

const toBytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const toB64 = (b: Uint8Array): string => Buffer.from(b).toString('base64').replace(/=+$/, '');
const fromB64 = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return new Uint8Array(Buffer.from(s + pad, 'base64'));
};

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = argon2id(toBytes(plain), salt, {
    t: ARGON2_OPTIONS.iterations,
    m: ARGON2_OPTIONS.memoryKiB,
    p: ARGON2_OPTIONS.parallelism,
    dkLen: ARGON2_OPTIONS.hashLength
  });
  return `$argon2id$v=19$m=${ARGON2_OPTIONS.memoryKiB},t=${ARGON2_OPTIONS.iterations},p=${ARGON2_OPTIONS.parallelism}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    const parts = hashed.split('$');
    // [ '', 'argon2id', 'v=19', 'm=...,t=...,p=...', salt, hash ]
    if (parts.length !== 6 || parts[1] !== 'argon2id') return false;
    const params = Object.fromEntries(parts[3]!.split(',').map((kv) => kv.split('=')));
    const salt = fromB64(parts[4]!);
    const expected = fromB64(parts[5]!);
    const actual = argon2id(toBytes(plain), salt, {
      t: Number(params.t ?? ARGON2_OPTIONS.iterations),
      m: Number(params.m ?? ARGON2_OPTIONS.memoryKiB),
      p: Number(params.p ?? ARGON2_OPTIONS.parallelism),
      dkLen: expected.length
    });
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function passwordMeetsPolicy(plain: string, minLength = 10): { ok: boolean; reason?: string } {
  if (plain.length < minLength) {
    return { ok: false, reason: `Password must be at least ${minLength} characters.` };
  }
  if (!/[a-z]/.test(plain) || !/[A-Z]/.test(plain) || !/[0-9]/.test(plain)) {
    return { ok: false, reason: 'Password must contain upper-case, lower-case and numeric characters.' };
  }
  return { ok: true };
}

/** HMAC-based reset/setup token hash, so only the digest is ever persisted. */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
