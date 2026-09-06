/**
 * Roles, permissions and the RBAC/ABAC permission model.
 *
 * FICMS uses role-based access control (a role carries a permission set)
 * combined with attribute-based rules (e.g. "only the clinician who owns a
 * draft consultation can edit it"). Permissions are enforced server-side;
 * the renderer uses the same matrix only for UI visibility.
 */

export const DEFAULT_ROLES = [
  'SYSTEM_ADMINISTRATOR',
  'CLINIC_OWNER',
  'CLINIC_DIRECTOR',
  'CLINIC_ADMINISTRATOR',
  'RECEPTIONIST',
  'FERTILITY_SPECIALIST',
  'DOCTOR',
  'EMBRYOLOGIST',
  'ANDROLOGIST',
  'LABORATORY_SCIENTIST',
  'SONOGRAPHER',
  'NURSE',
  'PHARMACIST',
  'COUNSELOR',
  'CASHIER',
  'FINANCE_OFFICER',
  'INVENTORY_OFFICER',
  'HUMAN_RESOURCES_OFFICER',
  'AUDITOR',
  'PATIENT'
] as const;

export type Role = (typeof DEFAULT_ROLES)[number];

export const PERMISSIONS = [
  // Core actions
  'view',
  'create',
  'update',
  'sign',
  'verify',
  'approve',
  'release',
  'correct',
  'export',
  'print',
  'archive',
  'cancel',
  'refund',
  'transfer',
  'dispose',
  'administer'
] as const;

export type PermissionAction = (typeof PERMISSIONS)[number];

export const RESOURCES = [
  'patient',
  'appointment',
  'consultation',
  'diagnosis',
  'treatment_plan',
  'prescription',
  'investigation',
  'clinical_record',
  'laboratory',
  'embryology',
  'andrology',
  'cryobank',
  'imaging',
  'nursing',
  'pharmacy',
  'inventory',
  'finance',
  'billing',
  'report',
  'counseling',
  'donor',
  'hr',
  'audit_log',
  'settings',
  'user',
  'role',
  'backup',
  'integration',
  'sync'
] as const;

export type Resource = (typeof RESOURCES)[number];

export type Permission = `${Resource}:${PermissionAction}` | '*';

export interface RoleDefinition {
  key: Role;
  label: string;
  description: string;
  permissions: Permission[];
  /** System roles cannot be edited or deleted. */
  system: boolean;
}

export interface SessionClaims {
  sub: string;
  userId: string;
  username: string;
  roles: Role[];
  permissions: Permission[];
  branchId?: string | null;
  /** Standalone/internal sessions are short-lived and host-scoped. */
  scope?: 'internal' | 'user';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TotpSetup {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export type SessionDeviceKind = 'desktop' | 'web' | 'mobile';
