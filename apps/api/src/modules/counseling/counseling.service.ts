import { Injectable } from '@nestjs/common';
import { notFound } from '@ficms/database';
import { DatabaseService } from '../../common/database.service';
import { FieldCryptoService } from '../../common/crypto.service';

/**
 * Counseling sessions with confidential, restricted notes. Notes are encrypted
 * at rest; the `restricted` flag marks a session visible only to authorized
 * staff (counselors and administrators), enforced by the caller's permissions.
 */
@Injectable()
export class CounselingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: FieldCryptoService
  ) {}

  async create(counselorId: string, input: { patientId: string; kind?: string; notes?: string | null; restricted?: boolean }) {
    const patient = await this.db.repos.patients.findById(input.patientId);
    if (!patient) throw notFound('Patient', input.patientId);
    const id = await this.db.repos.counseling.create({
      patientId: input.patientId,
      kind: input.kind ?? 'PRE_TREATMENT',
      notesEnc: input.notes ? this.crypto.encrypt(input.notes) : null,
      restricted: input.restricted,
      counselorId
    });
    return { id };
  }

  async listForPatient(patientId: string, canViewRestricted: boolean) {
    const rows = await this.db.repos.counseling.listForPatient(patientId);
    return rows
      .filter((r) => canViewRestricted || !r.restricted)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        restricted: Boolean(r.restricted),
        counselorId: r.counselor_id,
        createdAt: r.created_at,
        notes: r.notes_enc ? this.crypto.decrypt(String(r.notes_enc)) : null
      }));
  }
}
