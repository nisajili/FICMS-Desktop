import { Injectable } from '@nestjs/common';
import { loadConfigFromEnv, type FicmsConfig } from '@ficms/config';

/**
 * Holds validated runtime configuration. The standalone backend sets the
 * `FICMS_*` environment surface before bootstrapping, so a single service
 * works for connected, on-premise and standalone modes.
 */
@Injectable()
export class ConfigService {
  readonly config: FicmsConfig;

  constructor() {
    this.config = loadConfigFromEnv();
    if (!this.config.api.appSecret) {
      this.config.api.appSecret = process.env.FICMS_APP_SECRET ?? 'dev-only-secret';
    }
  }

  get api() {
    return this.config.api;
  }
  get database() {
    return this.config.database;
  }
  get security() {
    return this.config.security;
  }
  get storage() {
    return this.config.storage;
  }
  get standalone() {
    return this.config.standalone;
  }
  get queue() {
    return this.config.queue;
  }
}
