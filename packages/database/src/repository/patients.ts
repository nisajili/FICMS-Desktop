import type { SqlEngine } from '../engine/types';
import { newId, nowIso, notFound, paginateWith, badRequest } from './base';
import { nameKey, looksLikeDuplicate } from '@ficms/domain';

export interface PatientRow {
  id: string;
  mrn: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  nameKey: string;
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
  duplicateOfId: string | null;
  mergedIntoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterPatientData {
  mrn: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  sex: string;
  dateOfBirth?: string | null;
  nationalIdEnc?: string | null;
  primaryPhoneEnc?: string | null;
  emailEnc?: string | null;
  addressEnc?: string | null;
  bloodGroup?: string | null;
  branchId?: string | null;
  referredById?: string | null;
  referralNote?: string | null;
}

const PATIENT_SELECT = `SELECT id, mrn, first_name AS firstName, middle_name AS middleName, last_name AS lastName,
  name_key AS nameKey, sex, date_of_birth AS dateOfBirth, national_id_enc AS nationalIdEnc,
  primary_phone_enc AS primaryPhoneEnc, email_enc AS emailEnc, address_enc AS addressEnc,
  blood_group AS bloodGroup, status, branch_id AS branchId, referred_by_id AS referredById,
  referral_note AS referralNote, duplicate_of_id AS duplicateOfId, merged_into_id AS mergedIntoId,
  created_at AS createdAt, updated_at AS updatedAt FROM patients`;

export class PatientRepository {
  constructor(private readonly db: SqlEngine) {}

  async findById(id: string): Promise<PatientRow | undefined> {
    return this.db.get<PatientRow>(`${PATIENT_SELECT} WHERE id = ?`, [id]);
  }

  async findByMrn(mrn: string): Promise<PatientRow | undefined> {
    return this.db.get<PatientRow>(`${PATIENT_SELECT} WHERE mrn = ?`, [mrn]);
  }

  async search(query: string, page = 1, pageSize = 20): Promise<{ items: PatientRow[]; total: number; page: number; pageSize: number }> {
    const like = `%${query}%`;
    const key = nameKey(...query.split(/\s+/).slice(0, 2) as [string | undefined, string | undefined]);
    const where = `WHERE (mrn LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR name_key LIKE ? OR primary_phone_enc LIKE ?)`;
    const params = [like, like, like, `%${key}%`, like];
    const result = await paginateWith<PatientRow>(this.db, {
      select: PATIENT_SELECT,
      from: 'patients',
      where,
      params,
      orderBy: 'last_name, first_name',
      page,
      pageSize
    });
    return result;
  }

  async list(page = 1, pageSize = 20, status?: string): Promise<{ items: PatientRow[]; total: number; page: number; pageSize: number }> {
    const where = status ? `WHERE status = ?` : '';
    return paginateWith<PatientRow>(this.db, {
      select: PATIENT_SELECT,
      from: 'patients',
      where,
      params: status ? [status] : [],
      orderBy: 'created_at DESC',
      page,
      pageSize
    });
  }

  async create(data: RegisterPatientData): Promise<PatientRow> {
    const id = newId();
    const now = nowIso();
    const row: PatientRow = {
      id,
      mrn: data.mrn,
      firstName: data.firstName,
      middleName: data.middleName ?? null,
      lastName: data.lastName,
      nameKey: nameKey(data.firstName, data.lastName),
      sex: data.sex,
      dateOfBirth: data.dateOfBirth ?? null,
      nationalIdEnc: data.nationalIdEnc ?? null,
      primaryPhoneEnc: data.primaryPhoneEnc ?? null,
      emailEnc: data.emailEnc ?? null,
      addressEnc: data.addressEnc ?? null,
      bloodGroup: data.bloodGroup ?? null,
      status: 'ACTIVE',
      branchId: data.branchId ?? null,
      referredById: data.referredById ?? null,
      referralNote: data.referralNote ?? null,
      duplicateOfId: null,
      mergedIntoId: null,
      createdAt: now,
      updatedAt: now
    };
    await this.db.run(
      `INSERT INTO patients (id, mrn, first_name, middle_name, last_name, name_key, sex, date_of_birth, national_id_enc, primary_phone_enc, email_enc, address_enc, blood_group, status, branch_id, referred_by_id, referral_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, row.mrn, row.firstName, row.middleName, row.lastName, row.nameKey, row.sex, row.dateOfBirth,
        row.nationalIdEnc, row.primaryPhoneEnc, row.emailEnc, row.addressEnc, row.bloodGroup, row.status,
        row.branchId, row.referredById, row.referralNote, now, now
      ]
    );
    return row;
  }

  async update(id: string, patch: Partial<Pick<PatientRow, 'firstName' | 'middleName' | 'lastName' | 'sex' | 'dateOfBirth' | 'bloodGroup' | 'status' | 'branchId'>>): Promise<void> {
    const current = await this.findById(id);
    if (!current) throw notFound('Patient', id);
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      firstName: 'first_name',
      middleName: 'middle_name',
      lastName: 'last_name',
      sex: 'sex',
      dateOfBirth: 'date_of_birth',
      bloodGroup: 'blood_group',
      status: 'status',
      branchId: 'branch_id'
    };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${map[k]} = ?`);
      params.push(v);
    }
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      sets.push('name_key = ?');
      params.push(nameKey(patch.firstName ?? current.firstName, patch.lastName ?? current.lastName));
    }
    if (!sets.length) return;
    sets.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);
    await this.db.run(`UPDATE patients SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async findDuplicates(data: { firstName: string; lastName: string; dateOfBirth?: string | null; primaryPhone?: string | null }): Promise<PatientRow[]> {
    const key = nameKey(data.firstName, data.lastName);
    const rows = await this.db.all<PatientRow>(`${PATIENT_SELECT} WHERE name_key = ? OR primary_phone_enc = ?`, [key, data.primaryPhone ?? '__none__']);
    return rows.filter((r) => looksLikeDuplicate({ nameKey: r.nameKey, phone: r.primaryPhoneEnc }, { nameKey: key, phone: data.primaryPhone }));
  }

  /** Controlled merge: link source as duplicate of target; never deletes rows. */
  async merge(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) throw badRequest('Cannot merge a record with itself.', 'INVALID_MERGE');
    const source = await this.findById(sourceId);
    const target = await this.findById(targetId);
    if (!source || !target) throw notFound('Patient');
    await this.db.transaction(async (tx) => {
      await tx.run(`UPDATE patients SET duplicate_of_id = ?, merged_into_id = ?, status = 'ARCHIVED', updated_at = ? WHERE id = ?`, [targetId, targetId, nowIso(), sourceId]);
      // Re-point appointments and records that reference the source patient.
      await tx.run(`UPDATE appointments SET patient_id = ? WHERE patient_id = ?`, [targetId, sourceId]);
    });
  }

  async setPartners(primaryId: string, secondaryId: string, relationship = 'PARTNER'): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO partner_links (id, primary_patient_id, secondary_patient_id, relationship, created_at) VALUES (?, ?, ?, ?, ?)`,
      [newId(), primaryId, secondaryId, relationship, nowIso()]
    );
  }
}

export class AppointmentRepository {
  constructor(private readonly db: SqlEngine) {}

  async findById(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM appointments WHERE id = ?`, [id]);
  }

  async list(opts: { patientId?: string; providerId?: string; from?: string; to?: string; status?: string }): Promise<Record<string, unknown>[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts.patientId) {
      clauses.push('a.patient_id = ?');
      params.push(opts.patientId);
    }
    if (opts.providerId) {
      clauses.push('a.provider_id = ?');
      params.push(opts.providerId);
    }
    if (opts.from) {
      clauses.push('a.starts_at >= ?');
      params.push(opts.from);
    }
    if (opts.to) {
      clauses.push('a.starts_at < ?');
      params.push(opts.to);
    }
    if (opts.status) {
      clauses.push('a.status = ?');
      params.push(opts.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db.all(
      `SELECT a.*, p.first_name AS patientFirstName, p.last_name AS patientLastName, p.mrn AS patientMrn
       FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id
       ${where} ORDER BY a.starts_at`,
      params
    );
  }

  async create(data: {
    patientId: string;
    providerId?: string | null;
    branchId?: string | null;
    type?: string;
    title: string;
    startsAt: string;
    endsAt: string;
    notes?: string | null;
    clientRef?: string | null;
  }): Promise<string> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO appointments (id, patient_id, provider_id, branch_id, type, title, starts_at, ends_at, status, notes, client_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?)`,
      [id, data.patientId, data.providerId ?? null, data.branchId ?? null, data.type ?? 'CONSULTATION', data.title, data.startsAt, data.endsAt, data.notes ?? null, data.clientRef ?? null, now, now]
    );
    return id;
  }

  async checkIn(id: string): Promise<{ queueToken: string }> {
    const appt = await this.findById(id);
    if (!appt) throw notFound('Appointment', id);
    const queueToken = `Q-${String(new Date().getTime()).slice(-5)}`;
    await this.db.run(`UPDATE appointments SET status = 'CHECKED_IN', queue_token = ?, checked_in_at = ?, updated_at = ? WHERE id = ?`, [queueToken, nowIso(), nowIso(), id]);
    return { queueToken };
  }

  async checkOut(id: string): Promise<void> {
    await this.db.run(`UPDATE appointments SET status = 'COMPLETED', checked_out_at = ?, updated_at = ? WHERE id = ?`, [nowIso(), nowIso(), id]);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.run(`UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?`, [status, nowIso(), id]);
  }

  async cancel(id: string): Promise<void> {
    await this.db.run(`UPDATE appointments SET status = 'CANCELLED', updated_at = ? WHERE id = ?`, [nowIso(), id]);
  }
}

export class ReferralRepository {
  constructor(private readonly db: SqlEngine) {}

  async record(data: { patientId: string; referredById?: string | null; note?: string | null }): Promise<void> {
    await this.db.run(
      `INSERT INTO referrals (id, patient_id, referred_by_id, note, created_at) VALUES (?, ?, ?, ?, ?)`,
      [newId(), data.patientId, data.referredById ?? null, data.note ?? null, nowIso()]
    );
  }
}
