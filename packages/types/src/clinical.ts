import type { ID, ISODate, ISODateTime } from './common';

export type RecordStatus = 'DRAFT' | 'SIGNED' | 'VERIFIED' | 'RELEASED' | 'CORRECTED' | 'ARCHIVED';

export interface ConsultationNote {
  id: ID;
  patientId: ID;
  cycleId?: string | null;
  authorId: ID;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  status: RecordStatus;
  version: number;
  signedAt?: ISODateTime;
  signedById?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ClinicalAlert {
  id: ID;
  patientId: ID;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  active: boolean;
  createdAt: ISODateTime;
}

export interface Diagnosis {
  id: ID;
  patientId: ID;
  code?: string;
  description: string;
  onsetDate?: ISODate;
  createdAt: ISODateTime;
}

export type InvestigationStatus = 'ORDERED' | 'COLLECTED' | 'RESULTED' | 'RELEASED' | 'CANCELLED';

export interface Investigation {
  id: ID;
  patientId: ID;
  testCatalogId: string;
  status: InvestigationStatus;
  orderedById: string;
  orderedAt: ISODateTime;
}

export interface Prescription {
  id: ID;
  patientId: ID;
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  status: 'ACTIVE' | 'DISPENSED' | 'CANCELLED';
  prescribedById: string;
  createdAt: ISODateTime;
}

export type CycleType = 'IVF' | 'ICSI' | 'IUI' | 'FET' | 'OI' | 'EGG_FREEZE' | 'SPERM_FREEZE' | 'DIAGNOSTIC';

export type CycleStatus =
  | 'PLANNED'
  | 'STIMULATION'
  | 'MONITORING'
  | 'RETRIEVAL'
  | 'FERTILIZATION'
  | 'CULTURE'
  | 'TRANSFER'
  | 'PREGNANCY_TEST'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TreatmentCycle {
  id: ID;
  cycleNumber: string;
  patientId: ID;
  partnerPatientId?: string | null;
  type: CycleType;
  status: CycleStatus;
  protocolId?: string | null;
  startDate?: ISODate;
  clinicianId?: string | null;
  embryologistId?: string | null;
  createdAt: ISODateTime;
}

export interface CycleTimelineEvent {
  id: ID;
  cycleId: ID;
  day: number;
  title: string;
  kind: string;
  critical: boolean;
  notes?: string;
  occurredAt?: ISODateTime;
  createdAt: ISODateTime;
}
