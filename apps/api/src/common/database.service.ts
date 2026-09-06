import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { openDatabase, Repositories, ensureDefaults, type Database } from '@ficms/database';
import { ConfigService } from './config.service';

/**
 * Owns the database connection and exposes the repository aggregate to all
 * services. SQLite (WASM) for standalone/dev and PostgreSQL for server
 * deployments are selected purely from configuration.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db?: Database;
  repos!: Repositories;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const cfg = this.config.database;
    this.db = await openDatabase({
      url: cfg.url,
      sqlitePath: this.config.standalone.enabled ? cfg.url.replace(/^file:/, '') : undefined
    });
    this.repos = new Repositories(this.db.engine);
    await ensureDefaults(this.db.engine);
  }

  async onModuleDestroy(): Promise<void> {
    await this.db?.close();
  }

  get engine() {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.engine;
  }

  async backupTo(dest: string): Promise<{ path: string; bytes: number }> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.backupTo(dest);
  }

  async integrity(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.integrity();
  }
}
