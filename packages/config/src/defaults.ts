import type { FicmsConfig } from './schema';

/** Default configuration used by the embedded standalone backend. */
export function defaultConfig(overrides?: Partial<FicmsConfig>): FicmsConfig {
  return {
    api: {
      nodeEnv: 'production',
      host: '127.0.0.1',
      port: 0,
      baseUrl: 'http://127.0.0.1:0',
      apiPrefix: '/api/v1',
      logLevel: 'warn',
      corsOrigin: 'http://127.0.0.1',
      trustProxy: false,
      ...(overrides?.api ?? {})
    },
    database: {
      provider: 'sqlite',
      url: 'file:./ficms.db',
      encryptSensitiveFields: true,
      ...(overrides?.database ?? {})
    },
    redis: { enabled: false, url: 'redis://127.0.0.1:6379', prefix: 'ficms:', ...(overrides?.redis ?? {}) },
    queue: { enabled: true, inMemoryFallback: true, ...(overrides?.queue ?? {}) },
    storage: {
      driver: 'local',
      localRoot: '',
      s3: { region: 'auto', forcePathStyle: true },
      ...(overrides?.storage ?? {})
    },
    standalone: { enabled: true, port: 0, ...(overrides?.standalone ?? {}) },
    security: {
      sessionTtlSeconds: 28800,
      idleLockSeconds: 900,
      loginThrottleMax: 5,
      loginThrottleWindowSeconds: 300,
      accountLockoutMax: 10,
      totpWindow: 1,
      ...(overrides?.security ?? {})
    }
  };
}
