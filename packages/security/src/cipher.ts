import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * AES-256-GCM field-level encryption for sensitive clinical fields.
 *
 * In standalone mode the application relies on full-disk encryption
 * (BitLocker/FileVault/LUKS) for the database file; this module additionally
 * encrypts designated sensitive fields so that leaked data-at-rest files are
 * not trivially readable. The master key is derived from a secret stored in the
 * OS keychain (Electron safeStorage) and never shipped with the installer.
 */

export interface CipherContext {
  encrypt(plain: string): { iv: string; tag: string; ciphertext: string };
  decrypt(enc: { iv: string; tag: string; ciphertext: string }): string;
}

export function deriveKey(masterSecret: Buffer, salt: Buffer, keyLength = 32): Buffer {
  return scryptSync(masterSecret, salt, keyLength);
}

export function createCipherContext(key: Buffer): CipherContext {
  return {
    encrypt(plain: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return { iv: iv.toString('base64'), tag: tag.toString('base64'), ciphertext: enc.toString('base64') };
    },
    decrypt(enc: { iv: string; tag: string; ciphertext: string }) {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
      const dec = Buffer.concat([decipher.update(Buffer.from(enc.ciphertext, 'base64')), decipher.final()]);
      return dec.toString('utf8');
    }
  };
}

export interface EncryptedField {
  iv: string;
  tag: string;
  ciphertext: string;
}

export function isEncryptedField(v: unknown): v is EncryptedField {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as EncryptedField).iv === 'string' &&
    typeof (v as EncryptedField).tag === 'string' &&
    typeof (v as EncryptedField).ciphertext === 'string'
  );
}
