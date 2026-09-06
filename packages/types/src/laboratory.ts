import type { ID, ISODateTime } from './common';

export type WitnessStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Mandatory double-witness verification for identity-sensitive events. */
export interface WitnessVerification {
  id: ID;
  eventType: string;
  entityId: ID;
  primaryUserId: ID;
  witnessUserId: ID;
  status: WitnessStatus;
  verifiedAt?: ISODateTime;
  notes?: string;
}

export interface SemenAnalysis {
  id: ID;
  sampleId: string;
  patientId: ID;
  volumeMl?: number;
  concentrationMillionPerMl?: number;
  totalMotilityPercent?: number;
  progressiveMotilityPercent?: number;
  morphologyNormalPercent?: number;
  collectedAt: ISODateTime;
  analyzedById: string;
  verifiedById?: string | null;
  resultStatus: 'DRAFT' | 'VERIFIED' | 'RELEASED';
  createdAt: ISODateTime;
}

export interface EmbryoRecord {
  id: ID;
  cycleId: string;
  code: string;
  day: number;
  stage: string;
  grade?: string;
  quality?: 'GOOD' | 'FAIR' | 'POOR';
  notes?: string;
  frozen: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type OocyteMaturity = 'GV' | 'MI' | 'MII' | 'DEGENERATE' | 'ABNORMAL';

export interface OocyteRecord {
  id: ID;
  cycleId: string;
  count: number;
  maturity: OocyteMaturity;
  createdAt: ISODateTime;
}

export interface QcLogEntry {
  id: ID;
  equipment: string;
  kind: string;
  result: string;
  performedById: string;
  performedAt: ISODateTime;
}
