import type { SqlEngine } from '../engine/types';
import { newId, nowIso, notFound, json, parse, bool, FicmsError } from './base';
import { canEditClinicalRecord, type AttributeContext } from '@ficms/domain';

export interface ClinicalRow {
  id: string;
  patientId: string;
  kind: string;
  body: string;
  status: string;
  version: number;
  authorId: string;
  signedById: string | null;
  signedAt: string | null;
  supersedesId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Versioned clinical records. Signed records are immutable: an edit creates a
 * new version (superseding), and no record is ever hard-deleted — "delete"
 * archives. This satisfies the EMR integrity requirements.
 */
const CLINICAL_SELECT = `SELECT id, patient_id AS patientId, kind, body, status, version,
  author_id AS authorId, signed_by_id AS signedById, signed_at AS signedAt,
  supersedes_id AS supersedesId, archived_at AS archivedAt, created_at AS createdAt, updated_at AS updatedAt
  FROM clinical_records`;

export class ClinicalRepository {
  constructor(private readonly db: SqlEngine) {}

  async findById(id: string): Promise<ClinicalRow | undefined> {
    return this.db.get<ClinicalRow>(`${CLINICAL_SELECT} WHERE id = ?`, [id]);
  }

  async listForPatient(patientId: string): Promise<ClinicalRow[]> {
    return this.db.all<ClinicalRow>(
      `${CLINICAL_SELECT} WHERE patient_id = ? AND archived_at IS NULL ORDER BY created_at DESC`,
      [patientId]
    );
  }

  async create(data: { patientId: string; kind: string; body: object; authorId: string }): Promise<ClinicalRow> {
    const id = newId();
    const now = nowIso();
    const row: ClinicalRow = {
      id,
      patientId: data.patientId,
      kind: data.kind,
      body: json(data.body),
      status: 'DRAFT',
      version: 1,
      authorId: data.authorId,
      signedById: null,
      signedAt: null,
      supersedesId: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    };
    await this.db.run(
      `INSERT INTO clinical_records (id, patient_id, kind, body, status, version, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'DRAFT', 1, ?, ?, ?)`,
      [id, data.patientId, data.kind, row.body, data.authorId, now, now]
    );
    return row;
  }

  async versions(id: string): Promise<{ id: string; version: number; body: string; status: string; authorId: string; reason: string | null; createdAt: string }[]> {
    return this.db.all(
      `SELECT id, version, body, status, author_id AS authorId, reason, created_at AS createdAt FROM clinical_record_versions WHERE record_id = ? ORDER BY version DESC`,
      [id]
    );
  }

  /**
   * Edit policy:
   *  - DRAFT records: update in place, snapshotting the previous body.
   *  - SIGNED/RELEASED records: create a corrected new version (addendum),
   *    never mutating the signed body.
   */
  async update(data: {
    id: string;
    body: object;
    editorId: string;
    editorPermissions: string[];
    reason?: string;
  }): Promise<ClinicalRow> {
    const record = await this.findById(data.id);
    if (!record) throw notFound('Clinical record', data.id);

    const signed = record.status === 'SIGNED' || record.status === 'RELEASED' || record.status === 'VERIFIED';
    const allowed = canEditClinicalRecord(
      { permissions: data.editorPermissions as never, userId: data.editorId },
      { userId: data.editorId, isAuthor: record.authorId === data.editorId, recordSigned: signed } as AttributeContext
    );
    if (!allowed) {
      throw new FicmsError('FORBIDDEN', 'This clinical record cannot be edited by you.', 403);
    }

    return this.db.transaction(async (tx) => {
      if (!signed) {
        // Snapshot current body into version history.
        await tx.run(
          `INSERT INTO clinical_record_versions (id, record_id, version, body, status, author_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), record.id, record.version, record.body, record.status, record.authorId, data.reason ?? null, nowIso()]
        );
        const nextVersion = record.version + 1;
        await tx.run(`UPDATE clinical_records SET body = ?, version = ?, updated_at = ? WHERE id = ?`, [json(data.body), nextVersion, nowIso(), record.id]);
      } else {
        // Addendum / correction: create a new record that supersedes the signed one.
        const newRecordId = newId();
        const now = nowIso();
        await tx.run(
          `INSERT INTO clinical_records (id, patient_id, kind, body, status, version, author_id, supersedes_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'CORRECTED', 1, ?, ?, ?, ?)`,
          [newRecordId, record.patientId, record.kind, json(data.body), data.editorId, record.id, now, now]
        );
        await tx.run(`INSERT INTO clinical_record_versions (id, record_id, version, body, status, author_id, reason, created_at) VALUES (?, ?, 1, ?, 'CORRECTED', ?, ?, ?)`, [
          newId(), newRecordId, json(data.body), data.editorId, data.reason ?? 'Correction of signed record', nowIso()
        ]);
        await tx.run(`UPDATE clinical_records SET archived_at = ?, updated_at = ? WHERE id = ?`, [now, now, record.id]);
        const fresh = await tx.get<ClinicalRow>(`${CLINICAL_SELECT} WHERE id = ?`, [newRecordId]);
        return fresh!;
      }
      return (await tx.get<ClinicalRow>(`${CLINICAL_SELECT} WHERE id = ?`, [record.id]))!;
    });
  }

  async sign(id: string, signedById: string, signatureDigest: string): Promise<ClinicalRow> {
    const record = await this.findById(id);
    if (!record) throw notFound('Clinical record', id);
    await this.db.transaction(async (tx) => {
      await tx.run(`UPDATE clinical_records SET status = 'SIGNED', signed_by_id = ?, signed_at = ?, updated_at = ? WHERE id = ?`, [signedById, nowIso(), nowIso(), id]);
      await tx.run(
        `INSERT INTO e_signatures (id, record_id, signed_by_id, signature_digest, scope, signed_at) VALUES (?, ?, ?, ?, 'clinical', ?)`,
        [newId(), id, signedById, signatureDigest, nowIso()]
      );
    });
    return (await this.findById(id))!;
  }

  async verify(id: string, _verifiedById: string): Promise<void> {
    await this.db.run(`UPDATE clinical_records SET status = 'VERIFIED', updated_at = ? WHERE id = ?`, [nowIso(), id]);
  }

  async release(id: string, _releasedById: string): Promise<void> {
    await this.db.run(`UPDATE clinical_records SET status = 'RELEASED', updated_at = ? WHERE id = ?`, [nowIso(), id]);
  }

  async archive(id: string): Promise<void> {
    await this.db.run(`UPDATE clinical_records SET archived_at = ?, status = 'ARCHIVED', updated_at = ? WHERE id = ?`, [nowIso(), nowIso(), id]);
  }
}

export class ConsultationRepository {
  constructor(private readonly db: SqlEngine) {}

  async create(data: { patientId: string; cycleId?: string | null; authorId: string; subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null }): Promise<string> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO consultation_notes (id, patient_id, cycle_id, author_id, subjective, objective, assessment, plan, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 1, ?, ?)`,
      [id, data.patientId, data.cycleId ?? null, data.authorId, data.subjective ?? null, data.objective ?? null, data.assessment ?? null, data.plan ?? null, now, now]
    );
    return id;
  }

  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM consultation_notes WHERE patient_id = ? ORDER BY created_at DESC`, [patientId]);
  }

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM consultation_notes WHERE id = ?`, [id]);
  }

  async sign(id: string, signedById: string): Promise<void> {
    const note = await this.findById(id);
    if (!note) throw notFound('Consultation note', id);
    await this.db.run(`UPDATE consultation_notes SET status = 'SIGNED', signed_by_id = ?, signed_at = ?, updated_at = ? WHERE id = ?`, [signedById, nowIso(), nowIso(), id]);
  }
}

export class AlertRepository {
  constructor(private readonly db: SqlEngine) {}
  async create(patientId: string, severity: string, message: string): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO clinical_alerts (id, patient_id, severity, message, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`, [id, patientId, severity, message, nowIso()]);
    return id;
  }
  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM clinical_alerts WHERE patient_id = ? AND active = 1 ORDER BY created_at DESC`, [patientId]);
  }
}

export class DiagnosisRepository {
  constructor(private readonly db: SqlEngine) {}
  async create(patientId: string, description: string, code?: string, onsetDate?: string): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO diagnoses (id, patient_id, code, description, onset_date, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [id, patientId, code ?? null, description, onsetDate ?? null, nowIso()]);
    return id;
  }
  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM diagnoses WHERE patient_id = ? ORDER BY onset_date DESC`, [patientId]);
  }
}

export class PrescriptionRepository {
  constructor(private readonly db: SqlEngine) {}
  async create(data: { patientId: string; medication: string; dose?: string | null; route?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; prescribedById: string }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO prescriptions (id, patient_id, medication, dose, route, frequency, duration, instructions, status, prescribed_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [id, data.patientId, data.medication, data.dose ?? null, data.route ?? null, data.frequency ?? null, data.duration ?? null, data.instructions ?? null, data.prescribedById, nowIso()]
    );
    return id;
  }
  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC`, [patientId]);
  }
  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.run(`UPDATE prescriptions SET status = ? WHERE id = ?`, [status, id]);
  }
}

export class InvestigationRepository {
  constructor(private readonly db: SqlEngine) {}
  async create(data: { patientId: string; testCatalogId: string; orderedById: string; cycleId?: string | null; clinicalNote?: string | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO investigations (id, patient_id, test_catalog_id, status, ordered_by_id, cycle_id, clinical_note, created_at)
       VALUES (?, ?, ?, 'ORDERED', ?, ?, ?, ?)`,
      [id, data.patientId, data.testCatalogId, data.orderedById, data.cycleId ?? null, data.clinicalNote ?? null, nowIso()]
    );
    return id;
  }
  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT i.*, t.name AS testName FROM investigations i JOIN test_catalog t ON t.id = i.test_catalog_id WHERE i.patient_id = ? ORDER BY i.created_at DESC`,
      [patientId]
    );
  }
  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.run(`UPDATE investigations SET status = ? WHERE id = ?`, [status, id]);
  }
}

export { bool, parse, json };
