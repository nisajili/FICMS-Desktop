import type { SqlEngine } from '../engine/types';
import { newId, nowIso, json, parse, bool } from './base';

export interface ClinicSettingsRow {
  id: string;
  clinicName: string;
  tagline: string | null;
  legalName: string | null;
  country: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  locale: string;
  languages: string;
  address: string;
  contacts: string;
  brand: string;
  numbering: string;
  updatedAt: string;
}

export class SettingsRepository {
  constructor(private readonly db: SqlEngine) {}

  async get(): Promise<ClinicSettingsRow> {
    let row = await this.db.get<ClinicSettingsRow>(
      `SELECT id, clinic_name AS clinicName, tagline, legal_name AS legalName, country, currency,
              timezone, date_format AS dateFormat, locale, languages, address, contacts, brand, numbering,
              updated_at AS updatedAt
       FROM clinic_settings LIMIT 1`
    );
    if (!row) {
      const id = newId();
      row = {
        id,
        clinicName: '',
        tagline: null,
        legalName: null,
        country: '',
        currency: 'USD',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        locale: 'en',
        languages: '["en"]',
        address: '{}',
        contacts: '{}',
        brand: '{}',
        numbering: '{}',
        updatedAt: nowIso()
      };
      await this.db.run(
        `INSERT INTO clinic_settings (id, clinic_name, currency, timezone, date_format, locale, languages, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, '', 'USD', 'UTC', 'YYYY-MM-DD', 'en', '["en"]', nowIso()]
      );
    }
    return row;
  }

  async update(patch: Partial<Omit<ClinicSettingsRow, 'id' | 'updatedAt'>>): Promise<ClinicSettingsRow> {
    const current = await this.get();
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      clinicName: 'clinic_name',
      tagline: 'tagline',
      legalName: 'legal_name',
      country: 'country',
      currency: 'currency',
      timezone: 'timezone',
      dateFormat: 'date_format',
      locale: 'locale',
      languages: 'languages',
      address: 'address',
      contacts: 'contacts',
      brand: 'brand',
      numbering: 'numbering'
    };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const col = map[key];
      if (!col) continue;
      sets.push(`${col} = ?`);
      params.push(typeof value === 'string' ? value : json(value));
    }
    if (!sets.length) return current;
    sets.push('updated_at = ?');
    params.push(nowIso());
    params.push(current.id);
    await this.db.run(`UPDATE clinic_settings SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.get();
  }

  /** Allocate the next sequential number for a numbering series (atomic). */
  async nextNumber(series: 'mrn' | 'invoice' | 'cycle' | 'sample', prefix: string, padLength = 5): Promise<string> {
    return this.db.transaction(async (tx) => {
      const settings = await tx.get<ClinicSettingsRow>(`SELECT * FROM clinic_settings LIMIT 1`);
      const numbering = parse<Record<string, unknown>>(settings?.numbering, {});
      const counters = parse<Record<string, number>>(json(numbering.counters ?? {}), {});
      const next = (counters[series] ?? 0) + 1;
      counters[series] = next;
      numbering.counters = counters;
      await tx.run(`UPDATE clinic_settings SET numbering = ?, updated_at = ? WHERE id = ?`, [json(numbering), nowIso(), settings?.id]);
      return `${prefix}${String(next).padStart(padLength, '0')}`;
    });
  }
}

export class BranchRepository {
  constructor(private readonly db: SqlEngine) {}

  async list(activeOnly = false): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM branches ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY name`);
  }

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM branches WHERE id = ?`, [id]);
  }

  async create(data: { name: string; code: string; address?: object; phone?: string }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO branches (id, name, code, address, phone, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [id, data.name, data.code, json(data.address ?? {}), data.phone ?? null, nowIso()]
    );
    return id;
  }

  async update(id: string, patch: { name?: string; code?: string; address?: object; phone?: string | null; active?: boolean }): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = { name: 'name', code: 'code', address: 'address', phone: 'phone', active: 'active' };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${map[k]} = ?`);
      params.push(k === 'address' ? json(v) : typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (!sets.length) return;
    params.push(id);
    await this.db.run(`UPDATE branches SET ${sets.join(', ')} WHERE id = ?`, params);
  }
}

export class DepartmentRepository {
  constructor(private readonly db: SqlEngine) {}

  async list(): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM departments ORDER BY name`);
  }

  async create(data: { name: string; branchId?: string | null }): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO departments (id, name, branch_id, active) VALUES (?, ?, ?, 1)`, [id, data.name, data.branchId ?? null]);
    return id;
  }
}

export class ServiceCatalogRepository {
  constructor(private readonly db: SqlEngine) {}

  async list(activeOnly = true): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM service_catalog ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY category, name`);
  }

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM service_catalog WHERE id = ?`, [id]);
  }

  async create(data: { code: string; name: string; category?: string; priceMinor: number; currency?: string }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO service_catalog (id, code, name, category, price_minor, currency, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, data.code, data.name, data.category ?? 'GENERAL', data.priceMinor, data.currency ?? 'USD']
    );
    return id;
  }

  async update(id: string, patch: { name?: string; category?: string; priceMinor?: number; active?: boolean }): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = { name: 'name', category: 'category', priceMinor: 'price_minor', active: 'active' };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${map[k]} = ?`);
      params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (!sets.length) return;
    params.push(id);
    await this.db.run(`UPDATE service_catalog SET ${sets.join(', ')} WHERE id = ?`, params);
  }
}

export class TestCatalogRepository {
  constructor(private readonly db: SqlEngine) {}

  async list(activeOnly = true): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM test_catalog ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY category, name`);
  }

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM test_catalog WHERE id = ?`, [id]);
  }

  async findByCode(code: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM test_catalog WHERE code = ?`, [code]);
  }

  async create(data: {
    code: string;
    name: string;
    category?: string;
    unit?: string | null;
    referenceLow?: number | null;
    referenceHigh?: number | null;
    referenceText?: string | null;
    criticalLow?: number | null;
    criticalHigh?: number | null;
  }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO test_catalog (id, code, name, category, unit, reference_low, reference_high, reference_text, critical_low, critical_high, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, data.code, data.name, data.category ?? 'BIOCHEMISTRY', data.unit ?? null, data.referenceLow ?? null, data.referenceHigh ?? null, data.referenceText ?? null, data.criticalLow ?? null, data.criticalHigh ?? null]
    );
    return id;
  }
}

export class MedicationCatalogRepository {
  constructor(private readonly db: SqlEngine) {}

  async list(activeOnly = true): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM medication_catalog ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY name`);
  }

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM medication_catalog WHERE id = ?`, [id]);
  }

  async create(data: { code: string; name: string; form?: string | null; strength?: string | null; controlledSubstance?: boolean }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO medication_catalog (id, code, name, form, strength, controlled_substance, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, data.code, data.name, data.form ?? null, data.strength ?? null, data.controlledSubstance ? 1 : 0]
    );
    return id;
  }
}

export class TemplateRepository {
  constructor(private readonly db: SqlEngine, private readonly table: 'form_templates' | 'consent_templates') {}

  async list(): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM ${this.table} ORDER BY title`);
  }

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
  }

  async create(data: { code: string; title: string; body?: string; schema?: object; kind?: string }): Promise<string> {
    const id = newId();
    if (this.table === 'form_templates') {
      await this.db.run(
        `INSERT INTO form_templates (id, code, title, kind, schema, version, active) VALUES (?, ?, ?, ?, ?, 1, 1)`,
        [id, data.code, data.title, data.kind ?? 'CLINICAL', json(data.schema ?? {})]
      );
    } else {
      await this.db.run(
        `INSERT INTO consent_templates (id, code, title, body, version, active) VALUES (?, ?, ?, ?, 1, 1)`,
        [id, data.code, data.title, data.body ?? '']
      );
    }
    return id;
  }
}

/** Seed defaults for a fresh standalone install (idempotent). */
export async function ensureDefaults(db: SqlEngine): Promise<void> {
  const roles = new RoleRepositoryForSeed(db);
  await roles.ensureAll();
  const settings = await db.get(`SELECT id FROM clinic_settings LIMIT 1`);
  if (!settings) {
    await new SettingsRepository(db).get();
  }
}

class RoleRepositoryForSeed {
  constructor(private readonly db: SqlEngine) {}
  async ensureAll(): Promise<void> {
    const { ROLE_DEFINITIONS } = await import('@ficms/domain');
    for (const def of Object.values(ROLE_DEFINITIONS)) {
      const existing = await this.db.get(`SELECT id FROM roles WHERE key = ?`, [def.key]);
      if (existing) {
        await this.db.run(`UPDATE roles SET label = ?, description = ?, permissions = ?, system = ? WHERE key = ?`, [
          def.label,
          def.description,
          json(def.permissions),
          def.system ? 1 : 0,
          def.key
        ]);
      } else {
        await this.db.run(
          `INSERT INTO roles (id, key, label, description, permissions, system, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId(), def.key, def.label, def.description, json(def.permissions), def.system ? 1 : 0, nowIso()]
        );
      }
    }
  }
}

export function toPublicBranch(row: Record<string, unknown> | undefined): unknown {
  if (!row) return undefined;
  return { id: row.id, name: row.name, code: row.code, phone: row.phone ?? null, active: bool(row.active), address: parse(row.address, {}) };
}
