import type { SqlEngine } from '../engine/types';
import { newId, nowIso, notFound, json, parse } from './base';

export class SemenRepository {
  constructor(private readonly db: SqlEngine) {}

  async createSample(data: { barcode: string; patientId: string; collectedAt: string; collectionMethod?: string; abstinenceDays?: number | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO semen_samples (id, barcode, patient_id, collected_at, collection_method, abstinence_days, chain_of_custody, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`,
      [id, data.barcode, data.patientId, data.collectedAt, data.collectionMethod ?? 'CLINIC', data.abstinenceDays ?? null, nowIso()]
    );
    return id;
  }

  async findSampleByBarcode(barcode: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM semen_samples WHERE barcode = ?`, [barcode]);
  }

  async appendCustody(sampleId: string, entry: object): Promise<void> {
    const sample = await this.db.get<{ chain_of_custody: string }>(`SELECT chain_of_custody FROM semen_samples WHERE id = ?`, [sampleId]);
    if (!sample) throw notFound('Semen sample', sampleId);
    const chain = parse<object[]>(sample.chain_of_custody, []);
    chain.push(entry);
    await this.db.run(`UPDATE semen_samples SET chain_of_custody = ? WHERE id = ?`, [json(chain), sampleId]);
  }

  async addAnalysis(data: { sampleId: string; volumeMl?: number | null; concentration?: number | null; totalMotility?: number | null; progressiveMotility?: number | null; morphology?: number | null; analyzedById: string }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO semen_analyses (id, sample_id, volume_ml, concentration_million_per_ml, total_motility_percent, progressive_motility_percent, morphology_normal_percent, result_status, analyzed_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
      [id, data.sampleId, data.volumeMl ?? null, data.concentration ?? null, data.totalMotility ?? null, data.progressiveMotility ?? null, data.morphology ?? null, data.analyzedById, nowIso()]
    );
    return id;
  }

  async verifyAnalysis(id: string, verifiedById: string): Promise<void> {
    await this.db.run(`UPDATE semen_analyses SET result_status = 'VERIFIED', verified_by_id = ? WHERE id = ?`, [verifiedById, id]);
  }

  async releaseAnalysis(id: string): Promise<void> {
    await this.db.run(`UPDATE semen_analyses SET result_status = 'RELEASED' WHERE id = ?`, [id]);
  }

  async addPrep(data: { sampleId: string; method?: string; postWashConcentration?: number | null; postWashMotility?: number | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO sperm_preps (id, sample_id, method, post_wash_concentration, post_wash_motility, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.sampleId, data.method ?? 'DENSITY_GRADIENT', data.postWashConcentration ?? null, data.postWashMotility ?? null, nowIso()]
    );
    return id;
  }

  async addDnaFrag(data: { sampleId: string; percentDfi?: number | null; method?: string }): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO dna_fragmentations (id, sample_id, percent_dfi, method, created_at) VALUES (?, ?, ?, ?, ?)`, [id, data.sampleId, data.percentDfi ?? null, data.method ?? 'SCD', nowIso()]);
    return id;
  }
}

export class LabResultRepository {
  constructor(private readonly db: SqlEngine) {}

  async enter(data: {
    investigationId?: string | null;
    testId: string;
    value?: number | null;
    valueText?: string | null;
    unit?: string | null;
    enteredById: string;
  }): Promise<{ id: string; flag: string | null; critical: boolean }> {
    const test = await this.db.get<Record<string, unknown>>(`SELECT * FROM test_catalog WHERE id = ?`, [data.testId]);
    if (!test) throw notFound('Test catalog item', data.testId);

    const flag = this.computeFlag(test, data.value);
    const critical = flag === 'CRITICAL';
    const id = newId();
    await this.db.run(
      `INSERT INTO lab_results (id, investigation_id, test_id, value, value_text, unit, flag, status, entered_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ENTERED', ?, ?)`,
      [id, data.investigationId ?? null, data.testId, data.value ?? null, data.valueText ?? null, data.unit ?? null, flag, data.enteredById, nowIso()]
    );
    if (data.investigationId) {
      await this.db.run(`UPDATE investigations SET status = 'RESULTED' WHERE id = ?`, [data.investigationId]);
    }
    return { id, flag, critical };
  }

  private computeFlag(test: Record<string, unknown>, value?: number | null): string | null {
    if (value === null || value === undefined) return null;
    const low = test.reference_low as number | null | undefined;
    const high = test.reference_high as number | null | undefined;
    const critLow = test.critical_low as number | null | undefined;
    const critHigh = test.critical_high as number | null | undefined;
    if (critLow != null && value <= critLow) return 'CRITICAL';
    if (critHigh != null && value >= critHigh) return 'CRITICAL';
    if (low != null && value < low) return 'LOW';
    if (high != null && value > high) return 'HIGH';
    return 'NORMAL';
  }

  async verify(id: string, verifiedById: string): Promise<void> {
    await this.db.run(`UPDATE lab_results SET status = 'VERIFIED', verified_by_id = ?, verified_at = ? WHERE id = ?`, [verifiedById, nowIso(), id]);
  }

  async release(id: string, releasedById: string): Promise<void> {
    await this.db.run(`UPDATE lab_results SET status = 'RELEASED', released_by_id = ?, released_at = ? WHERE id = ?`, [releasedById, nowIso(), id]);
  }

  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT r.*, t.name AS testName, t.unit AS catalogUnit, t.reference_low AS referenceLow, t.reference_high AS referenceHigh
       FROM lab_results r
       JOIN test_catalog t ON t.id = r.test_id
       JOIN investigations i ON i.id = r.investigation_id
       WHERE i.patient_id = ? ORDER BY r.created_at DESC`,
      [patientId]
    );
  }

  async criticalUnsent(): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM lab_results WHERE flag = 'CRITICAL' AND critical_alert_sent = 0`);
  }

  async markCriticalSent(id: string): Promise<void> {
    await this.db.run(`UPDATE lab_results SET critical_alert_sent = 1 WHERE id = ?`, [id]);
  }
}

export class QcRepository {
  constructor(private readonly db: SqlEngine) {}
  async log(data: { equipment: string; kind: string; result: string; performedById: string }): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO qc_log_entries (id, equipment, kind, result, performed_by_id, performed_at) VALUES (?, ?, ?, ?, ?, ?)`, [id, data.equipment, data.kind, data.result, data.performedById, nowIso()]);
    return id;
  }
  async list(): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM qc_log_entries ORDER BY performed_at DESC LIMIT 500`);
  }
  async scheduleMaintenance(data: { equipment: string; task: string; dueDate: string }): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO equipment_maintenance (id, equipment, task, due_date, created_at) VALUES (?, ?, ?, ?, ?)`, [id, data.equipment, data.task, data.dueDate, nowIso()]);
    return id;
  }
}

export class AccessionRepository {
  constructor(private readonly db: SqlEngine) {}
  async create(data: { barcode: string; patientId: string; collectedAt: string; collectedById?: string | null; testIds: string[] }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO sample_accessions (id, barcode, patient_id, collected_at, collected_by_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'COLLECTED', ?)`,
      [id, data.barcode, data.patientId, data.collectedAt, data.collectedById ?? null, nowIso()]
    );
    for (const testId of data.testIds) {
      await this.db.run(`INSERT INTO sample_accession_items (id, accession_id, test_id) VALUES (?, ?, ?)`, [newId(), id, testId]);
    }
    return id;
  }
}
