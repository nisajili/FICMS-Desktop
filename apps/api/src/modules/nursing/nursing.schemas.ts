import { z } from 'zod';

export const VitalsSchema = z.object({
  patientId: z.string().min(1),
  systolic: z.number().int().min(0).max(400).optional().nullable(),
  diastolic: z.number().int().min(0).max(400).optional().nullable(),
  heartRate: z.number().int().min(0).max(400).optional().nullable(),
  temperatureC: z.string().max(8).optional().nullable(),
  weightKg: z.string().max(8).optional().nullable(),
  heightCm: z.string().max(8).optional().nullable(),
  spo2: z.number().int().min(0).max(100).optional().nullable()
});

export const CreateNoteSchema = z.object({
  patientId: z.string().min(1),
  kind: z.enum(['ASSESSMENT', 'MEDICATION', 'EDUCATION', 'CARE_PLAN', 'HANDOVER', 'OTHER']).optional(),
  title: z.string().max(160).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  restricted: z.boolean().optional()
});
