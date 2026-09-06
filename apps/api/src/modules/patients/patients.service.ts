import { BadRequestException, Injectable } from '@nestjs/common';
import { assertValidDateOfBirth } from '@ficms/domain';
import { notFound } from '@ficms/database';
import { DatabaseService } from '../../common/database.service';
import { FieldCryptoService } from '../../common/crypto.service';

@Injectable()
export class PatientsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: FieldCryptoService
  ) {}

  async register(input: {
    firstName: string;
    middleName?: string;
    lastName: string;
    sex: string;
    dateOfBirth?: string | null;
    nationalId?: string | null;
    primaryPhone?: string | null;
    email?: string | null;
    address?: object | null;
    bloodGroup?: string | null;
    referredById?: string | null;
    referralNote?: string | null;
    branchId?: string | null;
  }) {
    const dob = assertValidDateOfBirth(input.dateOfBirth);
    if (!dob.ok) throw new BadRequestException(dob.error.message);

    // Duplicate detection (never hard-blocking; returns candidates).
    const duplicates = await this.db.repos.patients.findDuplicates({
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      primaryPhone: input.primaryPhone
    });

    const mrn = await this.db.repos.settings.nextNumber('mrn', 'MRN-', 5);
    const patient = await this.db.repos.patients.create({
      mrn,
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      sex: input.sex,
      dateOfBirth: input.dateOfBirth,
      nationalIdEnc: input.nationalId ? this.crypto.encrypt(input.nationalId) : null,
      primaryPhoneEnc: input.primaryPhone ? this.crypto.encrypt(input.primaryPhone) : null,
      emailEnc: input.email ? this.crypto.encrypt(input.email) : null,
      addressEnc: input.address ? this.crypto.encrypt(JSON.stringify(input.address)) : null,
      bloodGroup: input.bloodGroup,
      branchId: input.branchId,
      referredById: input.referredById,
      referralNote: input.referralNote
    });
    if (input.referredById) {
      await this.db.repos.referrals.record({ patientId: patient.id, referredById: input.referredById, note: input.referralNote });
    }
    return { ...this.decryptPatient(patient), duplicateCandidates: duplicates.map((d) => ({ id: d.id, mrn: d.mrn, fullName: `${d.firstName} ${d.lastName}` })) };
  }

  async search(query: string, page = 1, pageSize = 20) {
    const result = await this.db.repos.patients.search(query, page, pageSize);
    return { ...result, items: result.items.map((p) => this.decryptPatient(p)) };
  }

  async list(page = 1, pageSize = 20, status?: string) {
    const result = await this.db.repos.patients.list(page, pageSize, status);
    return { ...result, items: result.items.map((p) => this.decryptPatient(p)) };
  }

  async get(id: string) {
    const patient = await this.db.repos.patients.findById(id);
    if (!patient) throw notFound('Patient', id);
    return this.decryptPatient(patient);
  }

  async update(id: string, patch: Partial<{
    firstName: string;
    middleName: string;
    lastName: string;
    sex: string;
    dateOfBirth: string | null;
    status: string;
    bloodGroup: string;
    branchId: string;
  }>) {
    const patient = await this.db.repos.patients.findById(id);
    if (!patient) throw notFound('Patient', id);
    const dob = assertValidDateOfBirth(patch.dateOfBirth ?? patient.dateOfBirth);
    if (!dob.ok) throw new BadRequestException(dob.error.message);
    await this.db.repos.patients.update(id, {
      firstName: patch.firstName,
      middleName: patch.middleName,
      lastName: patch.lastName,
      sex: patch.sex,
      dateOfBirth: patch.dateOfBirth,
      bloodGroup: patch.bloodGroup,
      status: patch.status,
      branchId: patch.branchId
    } as never);
    return this.get(id);
  }

  async merge(sourceId: string, targetId: string) {
    await this.db.repos.patients.merge(sourceId, targetId);
    return { merged: true };
  }

  async addPartner(patientId: string, partnerId: string, relationship: string) {
    await this.db.repos.patients.setPartners(patientId, partnerId, relationship);
    return { ok: true };
  }

  async duplicates(input: { firstName: string; lastName: string; dateOfBirth?: string | null; primaryPhone?: string | null }) {
    const rows = await this.db.repos.patients.findDuplicates(input);
    return rows.map((d) => ({ id: d.id, mrn: d.mrn, fullName: `${d.firstName} ${d.lastName}`, dateOfBirth: d.dateOfBirth }));
  }

  // --- Appointments -------------------------------------------------------

  async schedule(input: {
    patientId: string;
    providerId?: string | null;
    branchId?: string | null;
    type?: string;
    title: string;
    startsAt: string;
    endsAt: string;
    notes?: string | null;
    clientRef?: string | null;
  }) {
    const patient = await this.db.repos.patients.findById(input.patientId);
    if (!patient) throw notFound('Patient', input.patientId);
    if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
      throw new BadRequestException('Appointment end time must be after the start time.');
    }
    const id = await this.db.repos.appointments.create(input);
    return { id };
  }

  async appointments(opts: { patientId?: string; providerId?: string; from?: string; to?: string; status?: string }) {
    return this.db.repos.appointments.list(opts);
  }

  async checkIn(id: string) {
    return this.db.repos.appointments.checkIn(id);
  }

  async checkOut(id: string) {
    await this.db.repos.appointments.checkOut(id);
    return { ok: true };
  }

  async cancelAppointment(id: string) {
    await this.db.repos.appointments.cancel(id);
    return { ok: true };
  }

  private decryptPatient(p: {
    id: string;
    mrn: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    nameKey?: string;
    sex: string;
    dateOfBirth: string | null;
    nationalIdEnc: string | null;
    primaryPhoneEnc: string | null;
    emailEnc: string | null;
    addressEnc: string | null;
    bloodGroup: string | null;
    status: string;
    branchId: string | null;
    referredById: string | null;
    referralNote: string | null;
    duplicateOfId?: string | null;
    mergedIntoId?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }) {
    let address: unknown = null;
    try {
      address = p.addressEnc ? JSON.parse(this.crypto.decrypt(p.addressEnc) ?? 'null') : null;
    } catch {
      address = null;
    }
    return {
      id: p.id,
      mrn: p.mrn,
      fullName: `${p.firstName}${p.middleName ? ' ' + p.middleName : ''} ${p.lastName}`,
      firstName: p.firstName,
      middleName: p.middleName,
      lastName: p.lastName,
      sex: p.sex,
      dateOfBirth: p.dateOfBirth,
      nationalId: this.crypto.decrypt(p.nationalIdEnc),
      primaryPhone: this.crypto.decrypt(p.primaryPhoneEnc),
      email: this.crypto.decrypt(p.emailEnc),
      address,
      bloodGroup: p.bloodGroup,
      status: p.status,
      branchId: p.branchId,
      referredById: p.referredById,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    };
  }
}
