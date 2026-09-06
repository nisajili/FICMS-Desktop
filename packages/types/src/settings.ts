import type { ID } from './common';

export interface ClinicSettings {
  id: ID;
  clinicName: string;
  tagline?: string;
  legalName?: string;
  country: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  locale: string;
  languages: string[];
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  contacts?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  brand: {
    primaryColor: string;
    secondaryColor?: string;
    accentColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  numbering: {
    mrnPrefix: string;
    invoicePrefix: string;
    cyclePrefix: string;
    samplePrefix: string;
    nextMrn?: number;
    nextInvoice?: number;
    nextCycle?: number;
  };
  updatedAt: string;
}

export interface Branch {
  id: ID;
  name: string;
  code: string;
  address?: object;
  phone?: string;
  active: boolean;
}

export interface Department {
  id: ID;
  name: string;
  branchId?: string | null;
  active: boolean;
}
