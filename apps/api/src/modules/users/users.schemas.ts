import { z } from 'zod';
import { DEFAULT_ROLES } from '@ficms/types';

const roleEnum = z.enum(DEFAULT_ROLES as unknown as [string, ...string[]]);

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(10).max(256),
  fullName: z.string().min(1).max(120),
  email: z.string().email().optional().nullable(),
  roleKeys: z.array(roleEnum).min(1),
  branchId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  mustChangePassword: z.boolean().optional()
});

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  email: z.string().email().optional().nullable(),
  roleKeys: z.array(roleEnum).optional(),
  active: z.boolean().optional(),
  branchId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  mustChangePassword: z.boolean().optional()
});

export const UpdateRoleSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  description: z.string().optional().nullable(),
  permissions: z.array(z.string()).optional()
});
