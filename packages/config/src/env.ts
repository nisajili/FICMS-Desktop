import { parseConfig, type FicmsConfig } from './schema';

const MAP: Record<string, string> = {
  NODE_ENV: 'api.nodeEnv',
  FICMS_HOST: 'api.host',
  FICMS_PORT: 'api.port',
  FICMS_BASE_URL: 'api.baseUrl',
  FICMS_API_PREFIX: 'api.apiPrefix',
  FICMS_LOG_LEVEL: 'api.logLevel',
  FICMS_CORS_ORIGIN: 'api.corsOrigin',
  FICMS_APP_SECRET: 'api.appSecret',
  FICMS_TRUST_PROXY: 'api.trustProxy',
  FICMS_DB_PROVIDER: 'database.provider',
  DATABASE_URL: 'database.url',
  FICMS_FIELD_ENC_KEY: 'database.fieldEncryptionKey',
  FICMS_ENC_SENSITIVE: 'database.encryptSensitiveFields',
  FICMS_REDIS_ENABLED: 'redis.enabled',
  FICMS_REDIS_URL: 'redis.url',
  FICMS_REDIS_PREFIX: 'redis.prefix',
  FICMS_QUEUE_ENABLED: 'queue.enabled',
  FICMS_STORAGE_DRIVER: 'storage.driver',
  FICMS_STORAGE_LOCAL_ROOT: 'storage.localRoot',
  FICMS_S3_ENDPOINT: 'storage.s3.endpoint',
  FICMS_S3_REGION: 'storage.s3.region',
  FICMS_S3_BUCKET: 'storage.s3.bucket',
  FICMS_S3_ACCESS_KEY: 'storage.s3.accessKeyId',
  FICMS_S3_SECRET_KEY: 'storage.s3.secretAccessKey',
  FICMS_S3_FORCE_PATH: 'storage.s3.forcePathStyle',
  FICMS_STANDALONE: 'standalone.enabled',
  FICMS_STANDALONE_PORT: 'standalone.port',
  FICMS_STANDALONE_DATA_DIR: 'standalone.dataDir',
  FICMS_STANDALONE_BACKUP_DIR: 'standalone.backupDir',
  FICMS_SESSION_TTL: 'security.sessionTtlSeconds',
  FICMS_IDLE_LOCK: 'security.idleLockSeconds',
  FICMS_LOGIN_THROTTLE_MAX: 'security.loginThrottleMax',
  FICMS_LOGIN_THROTTLE_WINDOW: 'security.loginThrottleWindowSeconds',
  FICMS_ACCOUNT_LOCKOUT_MAX: 'security.accountLockoutMax'
};

function setPath(obj: Record<string, unknown>, dotted: string, value: unknown): void {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    cur[p] = (cur[p] as Record<string, unknown>) ?? {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

/**
 * Load configuration from `process.env`, mapping the documented FICMS_*
 * surface onto the validated config schema. Unknown keys are ignored so that
 * different deployment modes can share a single environment file.
 */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): FicmsConfig {
  const raw: Record<string, unknown> = {};
  for (const [envKey, path] of Object.entries(MAP)) {
    const value = env[envKey];
    if (value !== undefined && value !== '') {
      setPath(raw, path, value);
    }
  }
  return parseConfig(raw);
}
