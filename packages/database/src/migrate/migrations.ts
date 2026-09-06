import { initSchemaSql } from './0001_init';

export interface Migration {
  id: number;
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  { id: 1, name: 'init', up: initSchemaSql }
];
