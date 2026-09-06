import { z } from 'zod';

/**
 * Backend/standalone configuration schema. The same schema is reused by the
 * NestJS API, the worker and the embedded standalone backend so that a single
 * `FICMS_*` environment surface behaves identically everywhere.
 */

export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'silent']);

export const ApiConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  host: z.string().default('127.0.0.1'),
  port: z.coerce.number().int().min(1).max(65535).default(4123),
  /** Public base URL used to build absolute links and signed URLs. */
  baseUrl: z.string().url().default('http://127.0.0.1:4123'),
  apiPrefix: z.string().default('/api/v1'),
  logLevel: LogLevelSchema.default('info'),
  corsOrigin: z.string().default('*'),
  /** Encrypting secret: optional when the OS keychain provides one (standalone). */
  appSecret: z.string().optional(),
  trustProxy: z.coerce.boolean().default(false)
});

export const DatabaseConfigSchema = z.object({
  provider: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  url: z.string().default('file:./ficms.db'),
  /** AES-256-GCM field-encryption master key (base64). Optional in dev. */
  fieldEncryptionKey: z.string().optional(),
  /** When true, sensitive fields are stored encrypted at rest. */
  encryptSensitiveFields: z.coerce.boolean().default(true)
});

export const RedisConfigSchema = z.object({
  enabled: z.coerce.boolean().default(false),
  url: z.string().default('redis://127.0.0.1:6379'),
  prefix: z.string().default('ficms:')
});

export const QueueConfigSchema = z.object({
  enabled: z.coerce.boolean().default(true),
  /** In-memory fallback when Redis is not available. */
  inMemoryFallback: z.coerce.boolean().default(true)
});

export const StorageConfigSchema = z.object({
  driver: z.enum(['local', 's3']).default('local'),
  localRoot: z.string().default(''),
  s3: z
    .object({
      endpoint: z.string().optional(),
      region: z.string().default('auto'),
      bucket: z.string().optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      forcePathStyle: z.coerce.boolean().default(true)
    })
    .default({})
});

export const StandaloneConfigSchema = z.object({
  enabled: z.coerce.boolean().default(false),
  /** Dynamic port 0 = pick an ephemeral private port. */
  port: z.coerce.number().int().min(0).max(65535).default(0),
  dataDir: z.string().optional(),
  backupDir: z.string().optional(),
  /** Secret used to sign the short-lived internal token (generated per-boot). */
  internalTokenSecret: z.string().optional()
});

export const SecurityConfigSchema = z.object({
  sessionTtlSeconds: z.coerce.number().int().positive().default(28800),
  idleLockSeconds: z.coerce.number().int().positive().default(900),
  loginThrottleMax: z.coerce.number().int().positive().default(5),
  loginThrottleWindowSeconds: z.coerce.number().int().positive().default(300),
  accountLockoutMax: z.coerce.number().int().positive().default(10),
  totpWindow: z.coerce.number().int().min(0).max(3).default(1)
});

export const ConfigSchema = z.object({
  api: ApiConfigSchema.default({}),
  database: DatabaseConfigSchema.default({}),
  redis: RedisConfigSchema.default({}),
  queue: QueueConfigSchema.default({}),
  storage: StorageConfigSchema.default({}),
  standalone: StandaloneConfigSchema.default({}),
  security: SecurityConfigSchema.default({})
});

export type FicmsConfig = z.infer<typeof ConfigSchema>;
export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type StandaloneConfig = z.infer<typeof StandaloneConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

export function parseConfig(raw: unknown): FicmsConfig {
  return ConfigSchema.parse(raw);
}
