import { describe, it, expect } from 'vitest';
import { parseConfig, defaultConfig, loadConfigFromEnv } from '../src/index.js';

describe('config', () => {
  it('parses empty config with defaults', () => {
    const cfg = parseConfig({});
    expect(cfg.api.port).toBe(4123);
    expect(cfg.database.provider).toBe('sqlite');
  });
  it('builds standalone defaults', () => {
    const cfg = defaultConfig();
    expect(cfg.standalone.enabled).toBe(true);
    expect(cfg.api.host).toBe('127.0.0.1');
  });
  it('loads from environment variables', () => {
    const cfg = loadConfigFromEnv({
      FICMS_PORT: '5000',
      DATABASE_URL: 'file:/tmp/x.db',
      FICMS_REDIS_ENABLED: 'true',
      NODE_ENV: 'production'
    });
    expect(cfg.api.port).toBe(5000);
    expect(cfg.database.url).toBe('file:/tmp/x.db');
    expect(cfg.redis.enabled).toBe(true);
    expect(cfg.api.nodeEnv).toBe('production');
  });
  it('rejects invalid ports', () => {
    expect(() => parseConfig({ api: { port: 0 } })).toThrow();
  });
});
