import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from './auth.guard';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const req = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  return req.user!;
});
