import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';

@Injectable()
export class LaboratoryService {
  constructor(private readonly db: DatabaseService) {}

  async createSample(input: { patientId: string; collectedAt: string; collectionMethod?: string; abstinenceDays?: number | null }) {
    const barcode = await this.db.repos.settings.nextNumber('sample', 'SMP-', 8);
    const id = await this.db.repos.semen.createSample({ ...input, barcode });
    return { id, barcode };
  }

  async addAnalysis(input: { sampleId: string; volumeMl?: number | null; concentration?: number | null; totalMotility?: number | null; progressiveMotility?: number | null; morphology?: number | null }, userId: string) {
    return { id: await this.db.repos.semen.addAnalysis({ ...input, analyzedById: userId }) };
  }

  async verifyAnalysis(id: string, userId: string) {
    await this.db.repos.semen.verifyAnalysis(id, userId);
    return { ok: true };
  }

  async releaseAnalysis(id: string) {
    await this.db.repos.semen.releaseAnalysis(id);
    return { ok: true };
  }

  async enterResult(input: { investigationId?: string | null; testId: string; value?: number | null; valueText?: string | null; unit?: string | null }, userId: string) {
    return this.db.repos.labResults.enter({ ...input, enteredById: userId });
  }

  async verifyResult(id: string, userId: string) {
    await this.db.repos.labResults.verify(id, userId);
    return { ok: true };
  }

  async releaseResult(id: string, userId: string) {
    await this.db.repos.labResults.release(id, userId);
    return { ok: true };
  }

  async results(patientId: string) {
    return this.db.repos.labResults.listForPatient(patientId);
  }

  async criticalUnsent() {
    return this.db.repos.labResults.criticalUnsent();
  }

  async markCriticalSent(id: string) {
    await this.db.repos.labResults.markCriticalSent(id);
    return { ok: true };
  }

  async logQc(input: { equipment: string; kind: string; result: string }, userId: string) {
    return { id: await this.db.repos.qc.log({ ...input, performedById: userId }) };
  }

  async qcList() {
    return this.db.repos.qc.list();
  }

  async accession(input: { barcode: string; patientId: string; collectedAt: string; collectedById?: string | null; testIds: string[] }) {
    return { id: await this.db.repos.accessions.create(input) };
  }
}
