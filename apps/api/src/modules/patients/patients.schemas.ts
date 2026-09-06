import { z } from 'zod';

export const RegisterPatientSchema = z.object({
  firstName: z.string().min(1).max(80),
  middleName: z.string().max(80).optional(),
  lastName: z.string().min(1).max(80),
  sex: z.enum(['MALE', 'FEMALE', 'INTERSEX', 'UNSPECIFIED']),
  dateOfBirth: z.string().optional().nullable(),
  nationalId: z.string().max(64).optional().nullable(),
  primaryPhone: z.string().max(32).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    })
    .optional()
    .nullable(),
  bloodGroup: z.string().max(8).optional().nullable(),
  referredById: z.string().optional().nullable(),
  referralNote: z.string().optional().nullable(),
  branchId: z.string().optional().nullable()
});

export const UpdatePatientSchema = RegisterPatientSchema.partial().omit({ referredById: true, referralNote: true }).extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED', 'ARCHIVED']).optional()
});

export const ScheduleAppointmentSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  type: z.string().optional(),
  title: z.string().min(1).max(160),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  notes: z.string().optional().nullable(),
  clientRef: z.string().optional().nullable()
});

export const MergeSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1)
});

export const PartnerSchema = z.object({
  partnerId: z.string().min(1),
  relationship: z.enum(['PARTNER', 'SPOUSE', 'COUPLE']).optional()
});
