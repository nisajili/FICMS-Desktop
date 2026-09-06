import { Injectable } from '@nestjs/common';
import { sha256Hex } from '@ficms/security';
import { notFound } from '@ficms/database';
import { DatabaseService } from '../../common/database.service';

@Injectable()
export class ClinicalService {
  constructor(private readonly db: DatabaseService) {}

  async createRecord(userId: string, input: { patientId: string; kind: string; body: Record<string, unknown> }) {
    return this.db.repos.clinical.create({ patientId: input.patientId, kind: input.kind, body: input.body, authorId: userId });
  }

  async updateRecord(userId: string, permissions: string[], id: string, input: { body: Record<string, unknown>; reason?: string }) {
    return this.db.repos.clinical.update({ id, body: input.body, editorId: userId, editorPermissions: permissions, reason: input.reason });
  }

  async signRecord(id: string, signedById: string): Promise<unknown> {
    const record = await this.db.repos.clinical.findById(id);
    if (!record) throw notFound('Clinical record', id);
    // Signature digest commits to the exact record body being signed.
    const digest = sha256Hex(`${record.id}:${record.version}:${record.body}:${signedById}`);
    const signed = await this.db.repos.clinical.sign(id, signedById, digest);
    return signed;
  }

  async verify(id: string) {
    await this.db.repos.clinical.verify(id, '');
    return { ok: true };
  }

  async release(id: string, releasedById: string) {
    await this.db.repos.clinical.release(id, releasedById);
    return { ok: true };
  }

  async listForPatient(patientId: string) {
    return this.db.repos.clinical.listForPatient(patientId);
  }

  async versions(id: string) {
    const record = await this.db.repos.clinical.findById(id);
    if (!record) throw notFound('Clinical record', id);
    return { current: record, versions: await this.db.repos.clinical.versions(id) };
  }

  // --- Consultations ------------------------------------------------------

  async createConsultation(userId: string, input: {
    patientId: string;
    cycleId?: string | null;
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
  }) {
    const id = await this.db.repos.consultations.create({ ...input, authorId: userId });
    return { id };
  }

  async signConsultation(id: string, signedById: string) {
    await this.db.repos.consultations.sign(id, signedById);
    return { ok: true };
  }

  async consultations(patientId: string) {
    return this.db.repos.consultations.listForPatient(patientId);
  }

  // --- Other clinical data ------------------------------------------------

  async addDiagnosis(input: { patientId: string; code?: string | null; description: string; onsetDate?: string | null }) {
    const id = await this.db.repos.diagnoses.create(input.patientId, input.description, input.code ?? undefined, input.onsetDate ?? undefined);
    return { id };
  }

  async diagnoses(patientId: string) {
    return this.db.repos.diagnoses.listForPatient(patientId);
  }

  async addPrescription(userId: string, input: {
    patientId: string;
    medication: string;
    dose?: string | null;
    route?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
  }) {
    const id = await this.db.repos.prescriptions.create({ ...input, prescribedById: userId });
    return { id };
  }

  async prescriptions(patientId: string) {
    return this.db.repos.prescriptions.listForPatient(patientId);
  }

  async orderInvestigation(userId: string, input: { patientId: string; testCatalogId: string; cycleId?: string | null; clinicalNote?: string | null }) {
    const id = await this.db.repos.investigations.create({ ...input, orderedById: userId });
    return { id };
  }

  async investigations(patientId: string) {
    return this.db.repos.investigations.listForPatient(patientId);
  }

  async addAlert(input: { patientId: string; severity: string; message: string }) {
    const id = await this.db.repos.alerts.create(input.patientId, input.severity, input.message);
    return { id };
  }

  async alerts(patientId: string) {
    return this.db.repos.alerts.listForPatient(patientId);
  }
}
