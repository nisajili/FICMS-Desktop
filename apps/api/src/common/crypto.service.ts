import { Injectable } from '@nestjs/common';
import { createCipherContext, deriveKey, isEncryptedField, type EncryptedField } from '@ficms/security';
import { ConfigService } from './config.service';

const FIELD_SALT = 'ficms-field-encryption-v1';

/**
 * Field-level AES-256-GCM encryption for sensitive columns (contact details,
 * identifiers, confidential notes). The key is derived from the app secret
 * (or the OS keychain secret in standalone mode), never stored in the DB.
 */
@Injectable()
export class FieldCryptoService {
  private readonly context: ReturnType<typeof createCipherContext>;

  constructor(config: ConfigService) {
    const key = deriveKey(Buffer.from(config.api.appSecret ?? 'dev-only-secret', 'utf8'), Buffer.from(FIELD_SALT));
    this.context = createCipherContext(key);
  }

  encrypt(value: string): string {
    const enc = this.context.encrypt(value);
    return JSON.stringify(enc);
  }

  decrypt(stored: string | null | undefined): string | null {
    if (!stored) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isEncryptedField(parsed)) {
        return this.context.decrypt(parsed as EncryptedField);
      }
      return stored;
    } catch {
      return stored;
    }
  }
}
