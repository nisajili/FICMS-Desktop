import type { SqlEngine } from '../engine/types';
import { newId, nowIso } from './base';

/**
 * Imaging (ultrasound) and nursing repositories. Clinical notes are stored
 * encrypted (`*_enc`) by the API layer; these repositories never interpret the
 * ciphertext, keeping the data layer engine-agnostic.
 */
export class ImagingRepository {
  constructor(private readonly db: SqlEngine) {}

  async create(data: {
    patientId: string;
    type?: string;
    modality?: string | null;
    title: string;
    studyDate?: string | null;
    findingsEnc?: string | null;
    conclusionEnc?: string | null;
    performedBy?: string | null;
  }): Promise<string> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO imaging_studies (id, patient_id, type, modality, title, study_date, status, findings_enc, conclusion_enc, performed_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`,
      [id, data.patientId, data.type ?? 'ULTRASOUND', data.modality ?? null, data.title, data.studyDate ?? null, data.findingsEnc ?? null, data.conclusionEnc ?? null, data.performedBy ?? null, now, now]
    );
    return id;
  }

  async get(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(
      `SELECT id, patient_id AS patientId, type, modality, title, study_date AS studyDate, status,
        findings_enc AS findingsEnc, conclusion_enc AS conclusionEnc, performed_by AS performedBy,
        verified_by AS verifiedBy, verified_at AS verifiedAt, created_at AS createdAt, updated_at AS updatedAt
       FROM imaging_studies WHERE id = ?`,
      [id]
    );
  }

  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT id, patient_id AS patientId, type, modality, title, study_date AS studyDate, status,
        performed_by AS performedBy, verified_by AS verifiedBy, verified_at AS verifiedAt,
        created_at AS createdAt, updated_at AS updatedAt
       FROM imaging_studies WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );
  }

  async update(id: string, patch: { findingsEnc?: string | null; conclusionEnc?: string | null; status?: string; studyDate?: string | null }): Promise<void> {
    await this.db.run(
      `UPDATE imaging_studies SET findings_enc = ?, conclusion_enc = ?, status = ?, study_date = ?, updated_at = ? WHERE id = ?`,
      [patch.findingsEnc ?? null, patch.conclusionEnc ?? null, patch.status ?? 'DRAFT', patch.studyDate ?? null, nowIso(), id]
    );
  }

  async verify(id: string, verifiedBy: string): Promise<void> {
    await this.db.run(
      `UPDATE imaging_studies SET status = 'VERIFIED', verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?`,
      [verifiedBy, nowIso(), nowIso(), id]
    );
  }
}

export class NursingRepository {
  constructor(private readonly db: SqlEngine) {}

  async recordVitals(data: {
    patientId: string;
    systolic?: number | null;
    diastolic?: number | null;
    heartRate?: number | null;
    temperatureC?: string | null;
    weightKg?: string | null;
    heightCm?: string | null;
    spo2?: number | null;
    recordedBy?: string | null;
  }): Promise<string> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO nursing_vitals (id, patient_id, systolic, diastolic, heart_rate, temperature_c, weight_kg, height_cm, spo2, recorded_by, recorded_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.patientId, data.systolic ?? null, data.diastolic ?? null, data.heartRate ?? null, data.temperatureC ?? null, data.weightKg ?? null, data.heightCm ?? null, data.spo2 ?? null, data.recordedBy ?? null, now, now]
    );
    return id;
  }

  async listVitals(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT id, patient_id AS patientId, systolic, diastolic, heart_rate AS heartRate,
        temperature_c AS temperatureC, weight_kg AS weightKg, height_cm AS heightCm, spo2,
        recorded_by AS recordedBy, recorded_at AS recordedAt
       FROM nursing_vitals WHERE patient_id = ? ORDER BY recorded_at DESC`,
      [patientId]
    );
  }

  async createNote(data: {
    patientId: string;
    kind?: string;
    title?: string | null;
    notesEnc?: string | null;
    restricted?: boolean;
    recordedBy?: string | null;
  }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO nursing_notes (id, patient_id, kind, title, notes_enc, restricted, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.patientId, data.kind ?? 'ASSESSMENT', data.title ?? null, data.notesEnc ?? null, data.restricted ? 1 : 0, data.recordedBy ?? null, nowIso()]
    );
    return id;
  }

  async listNotes(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT id, patient_id AS patientId, kind, title, restricted, recorded_by AS recordedBy, created_at AS createdAt
       FROM nursing_notes WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );
  }
}
