import { z } from 'zod';

export const CreateSessionSchema = z.object({
  patientId: z.string().min(1),
  kind: z.enum(['PRE_TREATMENT', 'GENETIC', 'DONOR', 'GRIEF', 'COUPLES', 'OTHER']).optional(),
  notes: z.string().max(4000).optional().nullable(),
  restricted: z.boolean().optional()
});
