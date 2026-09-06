import type { ID, ISODateTime } from './common';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface AppointmentSummary {
  id: ID;
  patientId: ID;
  providerId?: string | null;
  title: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  status: AppointmentStatus;
  type: string;
  branchId?: string | null;
}

export interface AppointmentDetail extends AppointmentSummary {
  notes?: string;
  queueToken?: string;
  checkedInAt?: ISODateTime;
  checkedOutAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ScheduleAppointmentInput {
  patientId: ID;
  providerId?: string | null;
  type: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  notes?: string;
  branchId?: string | null;
}

export interface CheckInResult {
  appointmentId: ID;
  queueToken: string;
}
