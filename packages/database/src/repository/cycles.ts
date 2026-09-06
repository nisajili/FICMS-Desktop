import type { SqlEngine } from '../engine/types';
import { newId, nowIso, json } from './base';
import { gradeBlastocyst } from '@ficms/domain';

export interface CycleRow {
  id: string;
  cycleNumber: string;
  patientId: string;
  partnerPatientId: string | null;
  type: string;
  status: string;
  protocolId: string | null;
  startDate: string | null;
  clinicianId: string | null;
  embryologistId: string | null;
  outcome: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

const CYCLE_SELECT = `SELECT id, cycle_number AS cycleNumber, patient_id AS patientId,
  partner_patient_id AS partnerPatientId, type, status, protocol_id AS protocolId,
  start_date AS startDate, clinician_id AS clinicianId, embryologist_id AS embryologistId,
  outcome, summary, created_at AS createdAt, updated_at AS updatedAt FROM treatment_cycles`;

export class CycleRepository {
  constructor(private readonly db: SqlEngine) {}

  async findById(id: string): Promise<CycleRow | undefined> {
    return this.db.get<CycleRow>(`${CYCLE_SELECT} WHERE id = ?`, [id]);
  }

  async listForPatient(patientId: string): Promise<CycleRow[]> {
    return this.db.all<CycleRow>(`${CYCLE_SELECT} WHERE patient_id = ? ORDER BY created_at DESC`, [patientId]);
  }

  async create(data: {
    cycleNumber: string;
    patientId: string;
    partnerPatientId?: string | null;
    type?: string;
    protocolId?: string | null;
    startDate?: string | null;
    clinicianId?: string | null;
    embryologistId?: string | null;
  }): Promise<CycleRow> {
    const id = newId();
    const now = nowIso();
    const row: CycleRow = {
      id,
      cycleNumber: data.cycleNumber,
      patientId: data.patientId,
      partnerPatientId: data.partnerPatientId ?? null,
      type: data.type ?? 'IVF',
      status: 'PLANNED',
      protocolId: data.protocolId ?? null,
      startDate: data.startDate ?? null,
      clinicianId: data.clinicianId ?? null,
      embryologistId: data.embryologistId ?? null,
      outcome: null,
      summary: null,
      createdAt: now,
      updatedAt: now
    };
    await this.db.run(
      `INSERT INTO treatment_cycles (id, cycle_number, patient_id, partner_patient_id, type, status, protocol_id, start_date, clinician_id, embryologist_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PLANNED', ?, ?, ?, ?, ?, ?)`,
      [id, row.cycleNumber, row.patientId, row.partnerPatientId, row.type, row.protocolId, row.startDate, row.clinicianId, row.embryologistId, now, now]
    );
    return row;
  }

  async setStatus(id: string, status: string): Promise<void> {
    await this.db.run(`UPDATE treatment_cycles SET status = ?, updated_at = ? WHERE id = ?`, [status, nowIso(), id]);
  }

  async complete(id: string, outcome: string, summary?: string): Promise<void> {
    await this.db.run(`UPDATE treatment_cycles SET status = 'COMPLETED', outcome = ?, summary = ?, updated_at = ? WHERE id = ?`, [outcome, summary ?? null, nowIso(), id]);
  }

  async cancel(id: string, summary?: string): Promise<void> {
    await this.db.run(`UPDATE treatment_cycles SET status = 'CANCELLED', summary = ?, updated_at = ? WHERE id = ?`, [summary ?? null, nowIso(), id]);
  }

  // --- Timeline -----------------------------------------------------------

  async timeline(cycleId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM cycle_timeline_events WHERE cycle_id = ? ORDER BY day, created_at`, [cycleId]);
  }

  async addTimelineEvent(data: { cycleId: string; day: number; title: string; kind: string; critical?: boolean; notes?: string | null; occurredAt?: string | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO cycle_timeline_events (id, cycle_id, day, title, kind, critical, notes, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.cycleId, data.day, data.title, data.kind, data.critical ? 1 : 0, data.notes ?? null, data.occurredAt ?? null, nowIso()]
    );
    return id;
  }

  async markTimelineOccurred(id: string): Promise<void> {
    await this.db.run(`UPDATE cycle_timeline_events SET occurred_at = ? WHERE id = ?`, [nowIso(), id]);
  }

  // --- Monitoring ---------------------------------------------------------

  async addFollicle(data: { cycleId: string; date: string; ovary: string; count: number; sizesMm: number[]; endometriumMm?: number | null; notes?: string | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO follicle_measurements (id, cycle_id, date, ovary, count, sizes_mm, endometrium_mm, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.cycleId, data.date, data.ovary, data.count, json(data.sizesMm), data.endometriumMm ?? null, data.notes ?? null, nowIso()]
    );
    return id;
  }

  async follicleHistory(cycleId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM follicle_measurements WHERE cycle_id = ? ORDER BY date`, [cycleId]);
  }

  async addHormone(data: { cycleId: string; date: string; analyte: string; value: number; unit?: string | null; referenceRange?: string | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO hormone_results (id, cycle_id, date, analyte, value, unit, reference_range, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.cycleId, data.date, data.analyte, data.value, data.unit ?? null, data.referenceRange ?? null, nowIso()]
    );
    return id;
  }

  async hormoneHistory(cycleId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM hormone_results WHERE cycle_id = ? ORDER BY date`, [cycleId]);
  }

  async addOocytes(cycleId: string, maturity: string, count: number): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO oocyte_records (id, cycle_id, maturity, count, created_at) VALUES (?, ?, ?, ?, ?)`, [id, cycleId, maturity, count, nowIso()]);
    return id;
  }

  async oocytes(cycleId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM oocyte_records WHERE cycle_id = ? ORDER BY created_at`, [cycleId]);
  }

  async recordFertilization(data: { cycleId: string; method: string; eggsInseminated: number; twoPnCount?: number | null; abnormalFertilization?: number | null; notes?: string | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO fertilization_records (id, cycle_id, method, eggs_inseminated, two_pn_count, abnormal_fertilization, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.cycleId, data.method, data.eggsInseminated, data.twoPnCount ?? null, data.abnormalFertilization ?? null, data.notes ?? null, nowIso()]
    );
    return id;
  }

  // --- Embryology ---------------------------------------------------------

  async createEmbryo(data: {
    cycleId: string;
    code: string;
    day: number;
    stage: string;
    grade?: string | null;
    quality?: string | null;
    assistedHatching?: boolean;
    biopsied?: boolean;
    notes?: string | null;
  }): Promise<string> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO embryo_records (id, cycle_id, code, day, stage, grade, quality, assisted_hatching, biopsied, frozen, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, data.cycleId, data.code, data.day, data.stage, data.grade ?? null, data.quality ?? null, data.assistedHatching ? 1 : 0, data.biopsied ? 1 : 0, data.notes ?? null, now, now]
    );
    return id;
  }

  async embryo(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM embryo_records WHERE id = ?`, [id]);
  }

  async embryos(cycleId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM embryo_records WHERE cycle_id = ? ORDER BY day, code`, [cycleId]);
  }

  async updateEmbryo(id: string, patch: { stage?: string; grade?: string; quality?: string; assistedHatching?: boolean; biopsied?: boolean; frozen?: boolean; notes?: string | null }): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = { stage: 'stage', grade: 'grade', quality: 'quality', assistedHatching: 'assisted_hatching', biopsied: 'biopsied', frozen: 'frozen', notes: 'notes' };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${map[k]} = ?`);
      params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (!sets.length) return;
    sets.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);
    await this.db.run(`UPDATE embryo_records SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async addPgt(data: { cycleId: string; embryoId: string; testType?: string; result?: string | null; euploid?: boolean | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO pgt_records (id, cycle_id, embryo_id, test_type, result, euploid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.cycleId, data.embryoId, data.testType ?? 'PGT-A', data.result ?? null, data.euploid === undefined || data.euploid === null ? null : data.euploid ? 1 : 0, nowIso()]
    );
    return id;
  }

  async pgtResults(cycleId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT p.*, e.code AS embryoCode FROM pgt_records p JOIN embryo_records e ON e.id = p.embryo_id WHERE p.cycle_id = ? ORDER BY p.created_at`,
      [cycleId]
    );
  }
}

export { gradeBlastocyst };
