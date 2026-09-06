import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT } from './constants';

export interface RateLimitOptions {
  /** Max requests within the window per client. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT, options);

/**
 * In-memory sliding-window rate limiter. For multi-instance server
 * deployments, swap the store for Redis (documented in the admin guide); the
 * standalone and on-premise single-node modes are covered by this guard.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT, [context.getHandler(), context.getClass()]);
    if (!options) return true;

    const req = context.switchToHttp().getRequest<{ ip?: string; headers: Record<string, string | undefined> }>();
    const key = `${req.ip ?? 'unknown'}:${req.headers['user-agent'] ?? ''}`;
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= options.max) {
      this.hits.set(key, list);
      throw new HttpException({ statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMITED', message: 'Too many requests. Please retry shortly.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
}
