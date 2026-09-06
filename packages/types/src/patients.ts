import type { ID, ISODate, ISODateTime, Sex, Address, Contact } from './common';

export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED' | 'ARCHIVED';

export interface PatientSummary {
  id: ID;
  mrn: string;
  fullName: string;
  sex: Sex;
  dateOfBirth?: ISODate;
  primaryPhone?: string;
  status: PatientStatus;
  branchId?: string | null;
  createdAt: ISODateTime;
}

export interface PartnerLink {
  patientId: ID;
  relationship: 'PARTNER' | 'SPOUSE' | 'COUPLE';
}

export interface PatientDetail extends PatientSummary {
  address?: Address;
  contact?: Contact;
  nationalId?: string;
  bloodGroup?: string;
  referredById?: string | null;
  partners: PartnerLink[];
  duplicateOfId?: string | null;
  mergedIntoId?: string | null;
  updatedAt: ISODateTime;
}

export interface RegisterPatientInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  sex: Sex;
  dateOfBirth?: ISODate;
  nationalId?: string;
  primaryPhone?: string;
  email?: string;
  address?: Address;
  bloodGroup?: string;
  referredById?: string | null;
  branchId?: string | null;
}

export interface ReferralInput {
  referredById: string | null;
  referralNote?: string;
}
