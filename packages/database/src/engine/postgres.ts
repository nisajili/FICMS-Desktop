import { Client, type Pool } from 'pg';
import type { SqlEngine } from './types';

/**
 * PostgreSQL engine for connected / on-premise deployments. Pure-JS driver;
 * transactions map directly to PostgreSQL transactions. `?` placeholders are
 * translated to `$n` so repository SQL stays dialect-portable.
 */

export interface PostgresOptions {
  pool: Pool | Client;
  provider?: 'postgresql';
}

function translatePlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeParam(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (value === undefined) return null;
  return value;
}

type PgLike = { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };

export function createPostgresEngine(options: PostgresOptions): SqlEngine {
  const client = options.pool as unknown as PgLike;

  return {
    provider: 'postgresql',

    async exec(sql: string): Promise<void> {
      await client.query(sql);
    },

    async all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const res = await client.query(translatePlaceholders(sql), params.map(normalizeParam));
      return res.rows as T[];
    },

    async get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      const res = await client.query(translatePlaceholders(sql), params.map(normalizeParam));
      return res.rows[0] as T | undefined;
    },

    async run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertId?: string | number }> {
      const res = await client.query(translatePlaceholders(sql), params.map(normalizeParam));
      return { changes: res.rowCount ?? 0 };
    },

    async transaction<T>(fn: (tx: SqlEngine) => Promise<T>): Promise<T> {
      await client.query('BEGIN');
      try {
        const result = await fn(this as unknown as SqlEngine);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    },

    async close(): Promise<void> {
      await (options.pool as unknown as { end?: () => Promise<void> }).end?.();
    }
  };
}
