import { BadRequestException, Injectable } from '@nestjs/common';
import { notFound } from '@ficms/database';
import { DatabaseService } from '../../common/database.service';
import { FieldCryptoService } from '../../common/crypto.service';

/**
 * Donor management. Donor identity is encrypted at rest and never returned by
 * list views — only an authorized lookup surface decrypts it.
 */
@Injectable()
export class DonorsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: FieldCryptoService
  ) {}

  async create(input: { donorCode: string; identity?: object | null; status?: string }) {
    const existing = await this.db.repos.donors.list();
    if (existing.some((d) => d.donorCode === input.donorCode)) {
      throw new BadRequestException('A donor with this code already exists.');
    }
    const identityEnc = input.identity ? this.crypto.encrypt(JSON.stringify(input.identity)) : null;
    const id = await this.db.repos.donors.create({
      donorCode: input.donorCode,
      identityEnc,
      status: input.status
    });
    return { id, donorCode: input.donorCode, status: input.status ?? 'SCREENING' };
  }

  async list() {
    return this.db.repos.donors.list();
  }

  async addDonation(donorId: string, sampleBarcode: string) {
    const donor = await this.db.repos.donors.list();
    if (!donor.some((d) => d.id === donorId)) throw notFound('Donor', donorId);
    const id = await this.db.repos.donors.addDonation(donorId, sampleBarcode);
    return { id, donorId, sampleBarcode };
  }

  async listDonations(donorId?: string) {
    return this.db.repos.donors.listDonations(donorId);
  }
}
