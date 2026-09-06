import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  async get() {
    const row = await this.db.repos.settings.get();
    return {
      clinicName: row.clinicName,
      tagline: row.tagline,
      legalName: row.legalName,
      country: row.country,
      currency: row.currency,
      timezone: row.timezone,
      dateFormat: row.dateFormat,
      locale: row.locale,
      languages: safeJson(row.languages, ['en']),
      address: safeJson(row.address, {}),
      contacts: safeJson(row.contacts, {}),
      brand: safeJson(row.brand, {}),
      numbering: safeJson(row.numbering, {}),
      updatedAt: row.updatedAt
    };
  }

  async update(patch: Record<string, unknown>) {
    const row = await this.db.repos.settings.update(patch as never);
    return row;
  }

  async branches() {
    return this.db.repos.branches.list();
  }

  async createBranch(input: { name: string; code: string; address?: object; phone?: string }) {
    return { id: await this.db.repos.branches.create(input) };
  }

  async departments() {
    return this.db.repos.departments.list();
  }

  async createDepartment(input: { name: string; branchId?: string | null }) {
    return { id: await this.db.repos.departments.create(input) };
  }

  async services(activeOnly = true) {
    return this.db.repos.services.list(activeOnly);
  }

  async createService(input: { code: string; name: string; category?: string; priceMinor: number; currency?: string }) {
    return { id: await this.db.repos.services.create(input) };
  }

  async tests(activeOnly = true) {
    return this.db.repos.tests.list(activeOnly);
  }

  async createTest(input: {
    code: string;
    name: string;
    category?: string;
    unit?: string | null;
    referenceLow?: number | null;
    referenceHigh?: number | null;
    referenceText?: string | null;
    criticalLow?: number | null;
    criticalHigh?: number | null;
  }) {
    return { id: await this.db.repos.tests.create(input) };
  }

  async medications(activeOnly = true) {
    return this.db.repos.medications.list(activeOnly);
  }

  async createMedication(input: { code: string; name: string; form?: string | null; strength?: string | null; controlledSubstance?: boolean }) {
    return { id: await this.db.repos.medications.create(input) };
  }

  async formTemplates() {
    return this.db.repos.formTemplates.list();
  }

  async createFormTemplate(input: { code: string; title: string; schema?: object; kind?: string }) {
    return { id: await this.db.repos.formTemplates.create(input) };
  }

  async consentTemplates() {
    return this.db.repos.consentTemplates.list();
  }

  async createConsentTemplate(input: { code: string; title: string; body?: string }) {
    return { id: await this.db.repos.consentTemplates.create(input) };
  }
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
