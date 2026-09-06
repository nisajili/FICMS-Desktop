import { z } from 'zod';

export const CreateProfileSchema = z.object({
  userId: z.string().min(1),
  employeeNumber: z.string().max(32).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  jobTitle: z.string().max(80).optional().nullable(),
  hireDate: z.string().optional().nullable()
});

export const AttendanceSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().min(1),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable()
});

export const LeaveSchema = z.object({
  staffId: z.string().min(1),
  type: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER']).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1)
});

export const LeaveStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED'])
});

export const QualificationsSchema = z.object({
  qualifications: z.array(z.unknown()).max(100)
});
