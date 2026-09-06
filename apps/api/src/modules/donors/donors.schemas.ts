import { z } from 'zod';

export const CreateDonorSchema = z.object({
  donorCode: z.string().min(1).max(32),
  identity: z
    .object({
      fullName: z.string().max(120).optional(),
      dateOfBirth: z.string().optional(),
      sex: z.enum(['MALE', 'FEMALE', 'INTERSEX', 'UNSPECIFIED']).optional(),
      nationalId: z.string().max(64).optional()
    })
    .optional()
    .nullable(),
  status: z.enum(['SCREENING', 'ACTIVE', 'QUARANTINED', 'RELEASED', 'INACTIVE']).optional()
});

export const AddDonationSchema = z.object({
  donorId: z.string().min(1),
  sampleBarcode: z.string().min(1).max(64)
});
