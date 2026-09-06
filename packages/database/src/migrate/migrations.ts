import { initSchemaSql } from './0001_init';
import { clinicalSupportSchemaSql } from './0002_clinical_support';

export interface Migration {
  id: number;
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  { id: 1, name: 'init', up: initSchemaSql },
  { id: 2, name: 'clinical_support', up: clinicalSupportSchemaSql }
];
