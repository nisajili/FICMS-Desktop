import { Injectable } from '@nestjs/common';
import { notFound } from '@ficms/database';
import { DatabaseService } from '../../common/database.service';

@Injectable()
export class CyclesService {
  constructor(private readonly db: DatabaseService) {}

  async create(input: {
    patientId: string;
    partnerPatientId?: string | null;
    type?: string;
    protocolId?: string | null;
    startDate?: string | null;
    clinicianId?: string | null;
    embryologistId?: string | null;
  }) {
    const cycleNumber = await this.db.repos.settings.nextNumber('cycle', 'CYC-', 5);
    return this.db.repos.cycles.create({ ...input, cycleNumber });
  }

  async list(patientId?: string) {
    return this.db.repos.cycles.listForPatient(patientId ?? '');
  }

  async get(id: string) {
    const cycle = await this.db.repos.cycles.findById(id);
    if (!cycle) throw notFound('Cycle', id);
    return cycle;
  }

  async setStatus(id: string, status: string) {
    await this.db.repos.cycles.setStatus(id, status);
    return { ok: true };
  }

  async complete(id: string, outcome: string, summary?: string) {
    await this.db.repos.cycles.complete(id, outcome, summary);
    return { ok: true };
  }

  async cancel(id: string, summary?: string) {
    await this.db.repos.cycles.cancel(id, summary);
    return { ok: true };
  }

  async timeline(id: string) {
    return this.db.repos.cycles.timeline(id);
  }

  async addTimelineEvent(input: { cycleId: string; day: number; title: string; kind: string; critical?: boolean; notes?: string | null }) {
    return { id: await this.db.repos.cycles.addTimelineEvent(input) };
  }

  async markTimelineOccurred(id: string) {
    await this.db.repos.cycles.markTimelineOccurred(id);
    return { ok: true };
  }

  async addFollicle(input: { cycleId: string; date: string; ovary: string; count: number; sizesMm: number[]; endometriumMm?: number | null; notes?: string | null }) {
    return { id: await this.db.repos.cycles.addFollicle(input) };
  }

  async follicleHistory(cycleId: string) {
    return this.db.repos.cycles.follicleHistory(cycleId);
  }

  async addHormone(input: { cycleId: string; date: string; analyte: string; value: number; unit?: string | null; referenceRange?: string | null }) {
    return { id: await this.db.repos.cycles.addHormone(input) };
  }

  async hormoneHistory(cycleId: string) {
    return this.db.repos.cycles.hormoneHistory(cycleId);
  }

  async addOocytes(cycleId: string, maturity: string, count: number) {
    return { id: await this.db.repos.cycles.addOocytes(cycleId, maturity, count) };
  }

  async oocytes(cycleId: string) {
    return this.db.repos.cycles.oocytes(cycleId);
  }

  async recordFertilization(input: { cycleId: string; method: string; eggsInseminated: number; twoPnCount?: number | null; abnormalFertilization?: number | null; notes?: string | null }) {
    return { id: await this.db.repos.cycles.recordFertilization(input) };
  }

  async createEmbryo(input: {
    cycleId: string;
    code: string;
    day: number;
    stage: string;
    grade?: string | null;
    quality?: string | null;
    assistedHatching?: boolean;
    biopsied?: boolean;
    notes?: string | null;
  }) {
    return { id: await this.db.repos.cycles.createEmbryo(input) };
  }

  async embryos(cycleId: string) {
    return this.db.repos.cycles.embryos(cycleId);
  }

  async updateEmbryo(id: string, patch: { stage?: string; grade?: string; quality?: string; assistedHatching?: boolean; biopsied?: boolean; frozen?: boolean; notes?: string | null }) {
    await this.db.repos.cycles.updateEmbryo(id, patch);
    return { ok: true };
  }

  async addPgt(input: { cycleId: string; embryoId: string; testType?: string; result?: string | null; euploid?: boolean | null }) {
    return { id: await this.db.repos.cycles.addPgt(input) };
  }

  async pgtResults(cycleId: string) {
    return this.db.repos.cycles.pgtResults(cycleId);
  }
}
