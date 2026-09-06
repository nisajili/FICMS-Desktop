import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hashOpaqueToken, verifyInternalToken } from '@ficms/security';
import { PUBLIC_ROUTE } from './constants';
import { DatabaseService } from './database.service';
import { ConfigService } from './config.service';

export interface RequestUser {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  scope: 'internal' | 'user';
}

/**
 * Authentication guard.
 *
 *  - `Authorization: Bearer <opaque session token>` for interactive users.
 *  - `X-Internal-Token: <signed short-lived token>` for the embedded
 *    standalone backend (never exposed unauthenticated).
 *
 * The session token itself is never stored; only its SHA-256 digest lives in
 * the sessions table.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: RequestUser;
    }>();

    // Internal token (standalone backend).
    const internal = req.headers['x-internal-token'];
    if (internal && this.config.api.appSecret) {
      const result = verifyInternalToken(internal, this.config.api.appSecret);
      if (result.ok) {
        req.user = {
          userId: 'internal',
          username: 'internal',
          roles: ['SYSTEM_ADMINISTRATOR'],
          permissions: ['*'],
          scope: 'internal'
        };
        return true;
      }
    }

    const auth = req.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Missing authentication token.');
    }

    const tokenHash = hashOpaqueToken(token);
    const session = await this.db.repos.sessions.findByTokenHash(tokenHash);
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() < Date.now()) {
      if (isPublic) return true;
      throw new UnauthorizedException('Invalid or expired session.');
    }

    const user = await this.db.repos.users.findById(session.userId);
    if (!user || !user.active) {
      throw new UnauthorizedException('Account is inactive.');
    }
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      throw new UnauthorizedException('Account is temporarily locked.');
    }

    await this.db.repos.sessions.touch(session.id);
    req.user = {
      userId: user.id,
      username: user.username,
      roles: user.roles ?? [],
      permissions: user.permissions ?? [],
      scope: 'user'
    };
    return true;
  }
}
