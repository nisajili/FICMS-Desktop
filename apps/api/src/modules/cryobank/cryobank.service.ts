import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';

@Injectable()
export class CryobankService {
  constructor(private readonly db: DatabaseService) {}

  async hierarchy() {
    return this.db.repos.cryo.hierarchy();
  }

  async tanks() {
    return this.db.repos.cryo.tanksWithCapacity();
  }

  async items(opts: { patientId?: string; status?: string; entityType?: string }) {
    return this.db.repos.cryo.items(opts);
  }

  async store(input: {
    barcode: string;
    entityType: string;
    patientId: string;
    positionId: string;
    freezeAt: string;
    cycleId?: string | null;
    embryoId?: string | null;
    witnessUserId?: string | null;
  }, primaryUserId: string) {
    return { id: await this.db.repos.cryo.store({ ...input, primaryUserId }) };
  }

  async transfer(input: { itemId: string; toPositionId: string; reason?: string | null; witnessUserId?: string | null }, performedById: string) {
    await this.db.repos.cryo.transfer({ ...input, performedById });
    return { ok: true };
  }

  async releaseOrDispose(itemId: string, action: 'RELEASED' | 'DISPOSED', performedById: string, witnessUserId?: string | null, reason?: string | null) {
    await this.db.repos.cryo.releaseOrDispose(itemId, action, performedById, witnessUserId, reason);
    return { ok: true };
  }

  async createTank(roomId: string, name: string, capacitySlots?: number) {
    return { id: await this.db.repos.cryo.createTank({ roomId, name, capacitySlots }) };
  }

  async createFacility(name: string) {
    return { id: await this.db.repos.cryo.createFacility(name) };
  }

  async createRoom(facilityId: string, name: string) {
    return { id: await this.db.repos.cryo.createRoom(facilityId, name) };
  }

  async createCanister(tankId: string, name: string) {
    return { id: await this.db.repos.cryo.createCanister(tankId, name) };
  }

  async createCane(canisterId: string, name: string) {
    return { id: await this.db.repos.cryo.createCane(canisterId, name) };
  }

  async createGoblet(caneId: string, name: string) {
    return { id: await this.db.repos.cryo.createGoblet(caneId, name) };
  }

  async createRack(gobletId: string, name: string) {
    return { id: await this.db.repos.cryo.createRack(gobletId, name) };
  }

  async createPosition(rackId: string, row?: number | null, column?: number | null) {
    return { id: await this.db.repos.cryo.createPosition(rackId, row, column) };
  }

  async logTemperature(tankId: string, temperatureK: number) {
    await this.db.repos.cryo.logTemperature(tankId, temperatureK);
    return { ok: true };
  }

  async storageAgreement(input: { patientId: string; itemIds: string[]; signedAt: string; expiresAt?: string | null }) {
    return { id: await this.db.repos.cryo.storageAgreement(input) };
  }

  async witnessVerifications(entityId: string) {
    return this.db.repos.cryo.witnessVerifications(entityId);
  }
}
