import type { Row } from './api';

/** First defined value among candidate keys (snake_case or camelCase). */
export function cell(row: Row, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined || v === '') continue;
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return '—';
}

export function fmtDate(value: unknown): string {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export function fmtMoney(value: unknown, currency?: string): string {
  const minor = Number(value ?? 0);
  if (Number.isNaN(minor)) return '—';
  const amount = (minor / 100).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
}
