import { z } from 'zod';

export const CreateRecordSchema = z.object({
  patientId: z.string().min(1),
  kind: z.string().min(1).max(40),
  body: z.record(z.unknown())
});

export const UpdateRecordSchema = z.object({
  body: z.record(z.unknown()),
  reason: z.string().optional()
});

export const SignRecordSchema = z.object({
  // The signature digest is computed server-side from the record body + signer.
  confirm: z.boolean()
});

export const ConsultationSchema = z.object({
  patientId: z.string().min(1),
  cycleId: z.string().optional().nullable(),
  subjective: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  assessment: z.string().optional().nullable(),
  plan: z.string().optional().nullable()
});

export const DiagnosisSchema = z.object({
  patientId: z.string().min(1),
  code: z.string().optional().nullable(),
  description: z.string().min(1).max(500),
  onsetDate: z.string().optional().nullable()
});

export const PrescriptionSchema = z.object({
  patientId: z.string().min(1),
  medication: z.string().min(1).max(160),
  dose: z.string().optional().nullable(),
  route: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  instructions: z.string().optional().nullable()
});

export const InvestigationSchema = z.object({
  patientId: z.string().min(1),
  testCatalogId: z.string().min(1),
  cycleId: z.string().optional().nullable(),
  clinicalNote: z.string().optional().nullable()
});

export const AlertSchema = z.object({
  patientId: z.string().min(1),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  message: z.string().min(1).max(500)
});
