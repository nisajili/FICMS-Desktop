/**
 * A minimal, pluggable SQL engine contract. Both implementations expose the
 * same parameterized query surface; repositories stay engine-agnostic.
 */
export interface SqlEngine {
  readonly provider: 'sqlite' | 'postgresql';
  exec(sql: string): Promise<void>;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertId?: string | number }>;
  transaction<T>(fn: (tx: SqlEngine) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface SqliteFileOptions {
  /** Absolute path to the database file. `:memory:` disables persistence. */
  filePath: string;
  /** Called after the file is (re)written, e.g. to log or fsync. */
  onPersist?: (bytes: number) => void;
}

export interface SqliteEngine extends SqlEngine {
  provider: 'sqlite';
  /** Export the current database as a byte array (used by backups). */
  export(): Uint8Array;
  /** Persist the in-memory state to disk atomically. */
  flush(): Promise<void>;
  readonly filePath: string;
}
