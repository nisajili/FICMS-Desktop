import type { SqlEngine } from '../engine/types';
import { newId, nowIso } from '../db';

export { newId, nowIso };

export class FicmsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'FicmsError';
  }
}

export function notFound(resource: string, id?: string): FicmsError {
  return new FicmsError('NOT_FOUND', `${resource}${id ? ` (${id})` : ''} was not found.`, 404);
}

export function conflict(code: string, message: string): FicmsError {
  return new FicmsError(code, message, 409);
}

export function forbidden(message = 'You do not have permission to perform this action.'): FicmsError {
  return new FicmsError('FORBIDDEN', message, 403);
}

export function badRequest(message: string, code = 'BAD_REQUEST'): FicmsError {
  return new FicmsError(code, message, 400);
}

export interface CountRow {
  count: number;
}

export async function count(engine: SqlEngine, table: string, where = '', params: unknown[] = []): Promise<number> {
  const row = await engine.get<CountRow>(`SELECT COUNT(*) AS count FROM ${table} ${where}`, params);
  return Number(row?.count ?? 0);
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function paginate<T>(
  engine: SqlEngine,
  opts: {
    from: string;
    where?: string;
    params?: unknown[];
    orderBy?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<PageResult<T>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 20));
  const where = opts.where ?? '';
  const params = opts.params ?? [];
  const total = await count(engine, opts.from, where, params);
  const orderBy = opts.orderBy ? ` ORDER BY ${opts.orderBy}` : '';
  const items = await engine.all<T>(
    `SELECT * FROM ${opts.from} ${where}${orderBy} LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { items, total, page, pageSize };
}

/** Paginate with an explicit SELECT clause (e.g. aliased columns). */
export async function paginateWith<T>(
  engine: SqlEngine,
  opts: {
    select: string;
    from: string;
    where?: string;
    params?: unknown[];
    orderBy?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<PageResult<T>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 20));
  const where = opts.where ?? '';
  const params = opts.params ?? [];
  const total = await count(engine, opts.from, where, params);
  const orderBy = opts.orderBy ? ` ORDER BY ${opts.orderBy}` : '';
  const items = await engine.all<T>(
    `${opts.select} ${where}${orderBy} LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { items, total, page, pageSize };
}

/** Serialize a JS object for storage in a TEXT JSON column. */
export function json(value: unknown): string {
  return JSON.stringify(value ?? {});
}

/** Parse a TEXT JSON column with a fallback. */
export function parse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function bool(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

export function toBool(value: boolean): number {
  return value ? 1 : 0;
}
