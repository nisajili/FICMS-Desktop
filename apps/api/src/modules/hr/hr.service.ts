import { Injectable } from '@nestjs/common';
import { notFound } from '@ficms/database';
import { DatabaseService } from '../../common/database.service';

/**
 * Human-resources records: staff profiles, attendance and leave. These are
 * administrative records (not clinical), separated from user auth accounts.
 */
@Injectable()
export class HrService {
  constructor(private readonly db: DatabaseService) {}

  async listStaff() {
    return this.db.repos.hr.listStaff();
  }

  async createProfile(input: { userId: string; employeeNumber?: string | null; department?: string | null; jobTitle?: string | null; hireDate?: string | null }) {
    const user = await this.db.repos.users.findById(input.userId);
    if (!user) throw notFound('User', input.userId);
    const id = await this.db.repos.hr.createProfile(input);
    return { id };
  }

  async profileForUser(userId: string) {
    const profile = await this.db.repos.hr.profileForUser(userId);
    if (!profile) throw notFound('Staff profile for user', userId);
    return profile;
  }

  async attendance(input: { staffId: string; date: string; checkIn?: string | null; checkOut?: string | null }) {
    const id = await this.db.repos.hr.attendance(input.staffId, input.date, input.checkIn, input.checkOut);
    return { id };
  }

  async requestLeave(input: { staffId: string; type?: string; startDate: string; endDate: string }) {
    const id = await this.db.repos.hr.requestLeave({ staffId: input.staffId, type: input.type ?? 'ANNUAL', startDate: input.startDate, endDate: input.endDate });
    return { id, status: 'PENDING' };
  }

  async leaveStatus(id: string, status: string) {
    await this.db.repos.hr.leaveStatus(id, status);
    return { id, status };
  }

  async setQualifications(staffId: string, qualifications: unknown[]) {
    await this.db.repos.hr.setQualifications(staffId, qualifications);
    return { staffId, qualifications };
  }
}
