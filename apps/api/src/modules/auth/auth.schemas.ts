import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256)
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const TotpVerifySchema = z.object({
  challenge: z.string().min(8).max(256),
  code: z.string().regex(/^\d{6}$/)
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(10).max(256)
});

export const TotpDisableSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(1).max(256)
});

export const RecoverySchema = z.object({
  code: z.string().min(1).max(64),
  newPassword: z.string().min(10).max(256)
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(8).max(512)
});
