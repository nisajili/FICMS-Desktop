import type { SqlEngine } from '../engine/types';
import { newId, nowIso, json, parse } from './base';

export class CounselingRepository {
  constructor(private readonly db: SqlEngine) {}

  async create(data: { patientId: string; kind: string; notesEnc?: string | null; restricted?: boolean; counselorId: string }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO counseling_sessions (id, patient_id, kind, notes_enc, restricted, counselor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.patientId, data.kind, data.notesEnc ?? null, data.restricted ? 1 : 0, data.counselorId, nowIso()]
    );
    return id;
  }

  async listForPatient(patientId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM counseling_sessions WHERE patient_id = ? ORDER BY created_at DESC`, [patientId]);
  }
}

export class DonorRepository {
  constructor(private readonly db: SqlEngine) {}

  async create(data: { donorCode: string; identityEnc?: string | null; status?: string }): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO donors (id, donor_code, identity_enc, status, created_at) VALUES (?, ?, ?, ?, ?)`, [id, data.donorCode, data.identityEnc ?? null, data.status ?? 'SCREENING', nowIso()]);
    return id;
  }

  async list(): Promise<Record<string, unknown>[]> {
    // Identity is never returned in list views.
    return this.db.all(`SELECT id, donor_code AS donorCode, status, created_at AS createdAt FROM donors ORDER BY donor_code`);
  }

  async addDonation(donorId: string, sampleBarcode: string): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO donations (id, donor_id, sample_barcode, created_at) VALUES (?, ?, ?, ?)`, [id, donorId, sampleBarcode, nowIso()]);
    return id;
  }

  async listDonations(donorId?: string): Promise<Record<string, unknown>[]> {
    const where = donorId ? `WHERE donor_id = ?` : '';
    return this.db.all(
      `SELECT id, donor_id AS donorId, sample_barcode AS sampleBarcode, created_at AS createdAt
       FROM donations ${where} ORDER BY created_at DESC`,
      donorId ? [donorId] : []
    );
  }
}

export class HrRepository {
  constructor(private readonly db: SqlEngine) {}

  async profileForUser(userId: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM staff_profiles WHERE user_id = ?`, [userId]);
  }

  async createProfile(data: { userId: string; employeeNumber?: string | null; department?: string | null; jobTitle?: string | null; hireDate?: string | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO staff_profiles (id, user_id, employee_number, department, job_title, hire_date, qualifications) VALUES (?, ?, ?, ?, ?, ?, '[]')`,
      [id, data.userId, data.employeeNumber ?? null, data.department ?? null, data.jobTitle ?? null, data.hireDate ?? null]
    );
    return id;
  }

  async listStaff(): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT s.*, u.full_name AS fullName, u.username FROM staff_profiles s JOIN users u ON u.id = s.user_id ORDER BY u.full_name`
    );
  }

  async attendance(staffId: string, date: string, checkIn?: string | null, checkOut?: string | null): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO attendance (id, staff_id, date, check_in, check_out) VALUES (?, ?, ?, ?, ?)`, [id, staffId, date, checkIn ?? null, checkOut ?? null]);
    return id;
  }

  async requestLeave(data: { staffId: string; type: string; startDate: string; endDate: string }): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO leave_records (id, staff_id, type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`, [id, data.staffId, data.type, data.startDate, data.endDate]);
    return id;
  }

  async leaveStatus(id: string, status: string): Promise<void> {
    await this.db.run(`UPDATE leave_records SET status = ? WHERE id = ?`, [status, id]);
  }

  async setQualifications(staffId: string, qualifications: unknown[]): Promise<void> {
    await this.db.run(`UPDATE staff_profiles SET qualifications = ? WHERE id = ?`, [json(qualifications), staffId]);
  }
}

export { parse };
