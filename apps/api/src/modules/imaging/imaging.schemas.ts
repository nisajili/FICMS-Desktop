import { z } from 'zod';

export const CreateStudySchema = z.object({
  patientId: z.string().min(1),
  type: z.enum(['ULTRASOUND', 'SALINE_SONOGRAM', 'DOPPLER', 'FOLLICLE_SCAN', 'OTHER']).optional(),
  modality: z.string().max(40).optional().nullable(),
  title: z.string().min(1).max(160),
  studyDate: z.string().optional().nullable(),
  findings: z.string().max(4000).optional().nullable(),
  conclusion: z.string().max(2000).optional().nullable()
});

export const UpdateStudySchema = z.object({
  findings: z.string().max(4000).optional().nullable(),
  conclusion: z.string().max(2000).optional().nullable(),
  status: z.enum(['DRAFT', 'FINAL', 'VERIFIED']).optional(),
  studyDate: z.string().optional().nullable()
});
