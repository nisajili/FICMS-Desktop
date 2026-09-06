import type { Permission, Resource, Role } from '@ficms/types';
import { ROLE_DEFINITIONS } from './permissions';

/** Flatten the permissions of a set of roles into a unique permission list. */
export function permissionsForRoles(roles: Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    const def = ROLE_DEFINITIONS[role];
    if (!def) continue;
    if (def.permissions.includes('*')) return ['*'];
    for (const p of def.permissions) set.add(p);
  }
  return Array.from(set);
}

/** True when the actor holds `permission`, or the wildcard. */
export function hasPermission(actor: { permissions: Permission[] }, permission: Permission): boolean {
  if (actor.permissions.includes('*')) return true;
  return actor.permissions.includes(permission);
}

/** True when the actor holds any permission for `resource`. */
export function hasAnyPermissionFor(actor: { permissions: Permission[] }, resource: Resource): boolean {
  if (actor.permissions.includes('*')) return true;
  return actor.permissions.some((p) => p.startsWith(`${resource}:`));
}

export interface AttributeContext {
  userId?: string;
  patientId?: string;
  /** ABAC rule: restrict clinical draft editing to the author until signed. */
  isAuthor?: boolean;
  recordSigned?: boolean;
}

/**
 * Attribute-based check layered on top of RBAC. Example rule: a draft clinical
 * record may only be edited by its author or by a clinician with the `correct`
 * permission after it is signed.
 */
export function canEditClinicalRecord(
  actor: { permissions: Permission[]; userId?: string },
  ctx: AttributeContext
): boolean {
  if (hasPermission(actor, 'clinical_record:update')) {
    if (ctx.recordSigned) return hasPermission(actor, 'clinical_record:correct');
    return ctx.isAuthor ?? false;
  }
  return false;
}

export interface RbacDecision {
  allowed: boolean;
  reason?: string;
}

export function authorize(
  actor: { permissions: Permission[]; roles: Role[] },
  permission: Permission,
  ctx?: AttributeContext
): RbacDecision {
  if (actor.roles.includes('PATIENT')) {
    // Patients are always restricted to their own resources.
    if (ctx?.patientId && ctx.userId !== ctx.patientId) {
      return { allowed: false, reason: 'Patient access is limited to their own records.' };
    }
  }
  if (!hasPermission(actor, permission)) {
    return { allowed: false, reason: `Missing permission: ${permission}` };
  }
  return { allowed: true };
}
