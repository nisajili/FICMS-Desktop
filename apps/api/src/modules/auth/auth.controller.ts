import { Body, Controller, Get, Headers, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { RateLimit } from '../../common/rate-limit.guard';
import { Public, RequirePermissions } from '../../common/permissions.guard';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/auth.guard';
import { AuthGuard } from '../../common/auth.guard';
import {
  LoginSchema,
  LoginInput,
  TotpVerifySchema,
  ChangePasswordSchema,
  TotpDisableSchema,
  RecoverySchema,
  RefreshSchema
} from './auth.schemas';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit({ max: 10, windowSeconds: 60 })
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with username and password' })
  login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginInput, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.auth.login(body, ip, ua);
  }

  @Public()
  @RateLimit({ max: 20, windowSeconds: 60 })
  @Post('totp/verify')
  @ApiOperation({ summary: 'Complete two-factor authentication' })
  verifyTotp(
    @Body(new ZodValidationPipe(TotpVerifySchema)) body: { challenge: string; code: string },
    @Ip() ip: string,
    @Headers('user-agent') ua?: string
  ) {
    return this.auth.verifyTotpChallenge(body.challenge, body.code, ip, ua);
  }

  @Public()
  @RateLimit({ max: 10, windowSeconds: 60 })
  @Post('recover')
  @ApiOperation({ summary: 'Reset password using a recovery code' })
  recover(@Body(new ZodValidationPipe(RecoverySchema)) body: { code: string; newPassword: string }) {
    return this.auth.recoverWithCode(body.code, body.newPassword);
  }

  @Public()
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) body: { refreshToken: string }, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.auth.refresh(body.refreshToken, ip, ua);
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current session' })
  logout(@Req() req: { headers: Record<string, string | undefined> }) {
    const token = (req.headers['authorization'] ?? '').replace(/^Bearer /, '');
    return this.auth.logout(token);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Return the current user, roles and permissions' })
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.userId);
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(ChangePasswordSchema)) body: { currentPassword: string; newPassword: string }) {
    return this.auth.changePassword(user.userId, body.currentPassword, body.newPassword);
  }

  @UseGuards(AuthGuard)
  @Post('totp/setup')
  @RequirePermissions('user:update')
  setupTotp(@CurrentUser() user: RequestUser) {
    return this.auth.setupTotp(user.userId);
  }

  @UseGuards(AuthGuard)
  @Post('totp/confirm')
  confirmTotp(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(TotpVerifySchema.pick({ code: true }))) body: { code: string }) {
    return this.auth.confirmTotp(user.userId, body.code);
  }

  @UseGuards(AuthGuard)
  @Post('totp/disable')
  disableTotp(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(TotpDisableSchema)) body: { code: string; password: string }) {
    return this.auth.disableTotp(user.userId, body.code, body.password);
  }
}
