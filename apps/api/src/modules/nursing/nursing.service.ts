import { Injectable } from '@nestjs/common';
import { notFound } from '@ficms/database';
import { DatabaseService } from '../../common/database.service';
import { FieldCryptoService } from '../../common/crypto.service';

/**
 * Nursing documentation: structured vitals and free-text notes. Notes are
 * encrypted at rest; vitals are structured numeric/string columns.
 */
@Injectable()
export class NursingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: FieldCryptoService
  ) {}

  async recordVitals(recordedBy: string, input: {
    patientId: string;
    systolic?: number | null;
    diastolic?: number | null;
    heartRate?: number | null;
    temperatureC?: string | null;
    weightKg?: string | null;
    heightCm?: string | null;
    spo2?: number | null;
  }) {
    const patient = await this.db.repos.patients.findById(input.patientId);
    if (!patient) throw notFound('Patient', input.patientId);
    const id = await this.db.repos.nursing.recordVitals({ ...input, recordedBy });
    return { id };
  }

  async listVitals(patientId: string) {
    return this.db.repos.nursing.listVitals(patientId);
  }

  async createNote(recordedBy: string, input: { patientId: string; kind?: string; title?: string | null; notes?: string | null; restricted?: boolean }) {
    const patient = await this.db.repos.patients.findById(input.patientId);
    if (!patient) throw notFound('Patient', input.patientId);
    const id = await this.db.repos.nursing.createNote({
      patientId: input.patientId,
      kind: input.kind,
      title: input.title,
      notesEnc: input.notes ? this.crypto.encrypt(input.notes) : null,
      restricted: input.restricted,
      recordedBy
    });
    return { id };
  }

  async listNotes(patientId: string, canViewRestricted: boolean) {
    const rows = await this.db.repos.nursing.listNotes(patientId);
    return rows
      .filter((r) => canViewRestricted || !r.restricted)
      .map((r) => ({ ...r, restricted: Boolean(r.restricted) }));
  }
}
