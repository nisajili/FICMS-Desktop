import { Injectable } from '@nestjs/common';
import { notFound } from '@ficms/database';
import { DatabaseService } from '../../common/database.service';
import { FieldCryptoService } from '../../common/crypto.service';

/**
 * Ultrasound / imaging studies. Findings and conclusions are encrypted at rest.
 * Verification sets the study to VERIFIED with the verifying user recorded.
 */
@Injectable()
export class ImagingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: FieldCryptoService
  ) {}

  async create(performedBy: string, input: {
    patientId: string;
    type?: string;
    modality?: string | null;
    title: string;
    studyDate?: string | null;
    findings?: string | null;
    conclusion?: string | null;
  }) {
    const patient = await this.db.repos.patients.findById(input.patientId);
    if (!patient) throw notFound('Patient', input.patientId);
    const id = await this.db.repos.imaging.create({
      patientId: input.patientId,
      type: input.type,
      modality: input.modality,
      title: input.title,
      studyDate: input.studyDate,
      findingsEnc: input.findings ? this.crypto.encrypt(input.findings) : null,
      conclusionEnc: input.conclusion ? this.crypto.encrypt(input.conclusion) : null,
      performedBy
    });
    return { id };
  }

  async get(id: string) {
    const study = await this.db.repos.imaging.get(id);
    if (!study) throw notFound('Imaging study', id);
    return this.decrypt(study);
  }

  async listForPatient(patientId: string) {
    const rows = await this.db.repos.imaging.listForPatient(patientId);
    return rows.map((r) => this.decryptSummary(r));
  }

  async update(id: string, patch: { findings?: string | null; conclusion?: string | null; status?: string; studyDate?: string | null }) {
    const study = await this.db.repos.imaging.get(id);
    if (!study) throw notFound('Imaging study', id);
    await this.db.repos.imaging.update(id, {
      findingsEnc: patch.findings !== undefined ? (patch.findings ? this.crypto.encrypt(patch.findings) : null) : undefined,
      conclusionEnc: patch.conclusion !== undefined ? (patch.conclusion ? this.crypto.encrypt(patch.conclusion) : null) : undefined,
      status: patch.status,
      studyDate: patch.studyDate
    });
    return this.get(id);
  }

  async verify(id: string, verifiedBy: string) {
    const study = await this.db.repos.imaging.get(id);
    if (!study) throw notFound('Imaging study', id);
    await this.db.repos.imaging.verify(id, verifiedBy);
    return this.get(id);
  }

  private decrypt(study: Record<string, unknown>) {
    return {
      ...study,
      findings: this.crypto.decrypt(study.findingsEnc as string | null),
      conclusion: this.crypto.decrypt(study.conclusionEnc as string | null)
    };
  }

  private decryptSummary(study: Record<string, unknown>) {
    const summary = { ...study };
    delete summary.findingsEnc;
    delete summary.conclusionEnc;
    return summary;
  }
}
