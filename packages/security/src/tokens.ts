import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SessionClaims } from '@ficms/types';

/** Internal short-lived bearer token used between the desktop and its embedded backend. */
export function generateInternalToken(secret: string, ttlSeconds = 300, scope = 'internal'): string {
  const payload = Buffer.from(JSON.stringify({ scope, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${payload}.${exp}`;
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifyInternalToken(token: string, secret: string): { ok: boolean; claims?: { scope: string; iat: number } } {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false };
  const [payload, expStr, sig] = parts as [string, string, string];
  const body = `${payload}.${expStr}`;
  if (!safeVerify(body, sig, secret)) return { ok: false };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return { ok: false };
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { scope: string; iat: number };
    return { ok: true, claims };
  } catch {
    return { ok: false };
  }
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function safeVerify(body: string, sig: string, secret: string): boolean {
  const expected = sign(body, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function issueSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function isSessionClaims(c: unknown): c is SessionClaims {
  return typeof c === 'object' && c !== null && typeof (c as SessionClaims).sub === 'string';
}
