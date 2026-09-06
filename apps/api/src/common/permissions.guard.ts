import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, authorize } from '@ficms/domain';
import type { Permission } from '@ficms/types';
import { PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from './constants';
import type { RequestUser } from './auth.guard';

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

/**
 * RBAC + ABAC enforcement. Backend-authoritative: even if the renderer hides a
 * control, the API rejects requests whose caller lacks the required permission.
 * Patients are restricted to their own resources (checked in services that
 * receive a patientId).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;
    if (!user) return false;

    if (user.permissions.includes('*')) return true;

    for (const permission of required) {
      const decision = authorize({ permissions: user.permissions as never[], roles: user.roles as never[] }, permission);
      if (!decision.allowed) {
        throw new ForbiddenException(decision.reason ?? `Missing permission: ${permission}`);
      }
    }
    return true;
  }
}

export { hasPermission };
