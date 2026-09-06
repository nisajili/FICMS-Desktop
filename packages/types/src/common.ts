export type ID = string;
export type ISODate = string;
export type ISODateTime = string;
export type UUID = string;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

export type Sex = 'MALE' | 'FEMALE' | 'INTERSEX' | 'UNSPECIFIED';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
}

export interface Contact {
  phone?: string;
  email?: string;
}

export interface NamedEntity {
  id: ID;
  name: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
