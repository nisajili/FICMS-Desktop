import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  verifyPassword,
  hashPassword,
  passwordMeetsPolicy,
  generateTotpSecret,
  totpUri,
  verifyTotp,
  generateRecoveryCodes,
  safeEqual
} from '@ficms/security';
import { DatabaseService } from '../../common/database.service';
import { ConfigService } from '../../common/config.service';
import type { LoginInput } from './auth.schemas';

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface MfaChallenge {
  userId: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly mfaChallenges = new Map<string, MfaChallenge>();

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  async login(input: LoginInput, ip?: string, userAgent?: string): Promise<unknown> {
    const user = await this.db.repos.users.findByUsername(input.username);
    // Constant-ish behaviour: always run a password verification attempt.
    const passwordOk = user ? await verifyPassword(user.passwordHash, input.password) : await verifyPassword('$argon2id$v=19$m=65536,t=3,p=1$AAAA$AAAA', input.password);

    if (!user || !passwordOk) {
      if (user) await this.registerFailedLogin(user.id);
      throw new UnauthorizedException('Invalid username or password.');
    }

    if (!user.active) throw new UnauthorizedException('Account is inactive.');
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      throw new UnauthorizedException('Account is temporarily locked due to repeated failed attempts.');
    }

    await this.db.repos.users.update(user.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() });

    // 2FA challenge when enabled.
    if (user.twoFactorEnabled) {
      const challenge = generateOpaqueToken(32);
      this.mfaChallenges.set(challenge, { userId: user.id, expiresAt: Date.now() + MFA_CHALLENGE_TTL_MS });
      return { mfaRequired: true, challenge };
    }

    return this.issueSession(user.id, ip, userAgent);
  }

  async verifyTotpChallenge(challenge: string, code: string, ip?: string, userAgent?: string): Promise<unknown> {
    const entry = this.mfaChallenges.get(challenge);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException('Two-factor challenge expired. Please sign in again.');
    }
    const user = await this.db.repos.users.findById(entry.userId);
    if (!user) throw new UnauthorizedException('User not found.');
    const secret = user.totpSecretEnc;
    if (!secret || !verifyTotp(secret, code, this.config.security.totpWindow)) {
      throw new UnauthorizedException('Invalid verification code.');
    }
    this.mfaChallenges.delete(challenge);
    return this.issueSession(user.id, ip, userAgent);
  }

  async issueSession(userId: string, ip?: string, userAgent?: string): Promise<unknown> {
    const accessToken = generateOpaqueToken(32);
    const refreshToken = generateOpaqueToken(32);
    const expiresIn = this.config.security.sessionTtlSeconds;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    await this.db.repos.sessions.create({
      userId,
      tokenHash: hashOpaqueToken(accessToken),
      refreshHash: hashOpaqueToken(refreshToken),
      ip,
      userAgent,
      deviceKind: 'desktop',
      expiresAt
    });
    const user = await this.db.repos.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found.');
    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      user: this.publicUser(user)
    };
  }

  async refresh(refreshToken: string, ip?: string, userAgent?: string): Promise<unknown> {
    const hash = hashOpaqueToken(refreshToken);
    const session = await this.db.repos.sessions.findByTokenHash(hash);
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    await this.db.repos.sessions.revoke(session.id);
    return this.issueSession(session.userId, ip, userAgent);
  }

  async logout(accessToken: string): Promise<void> {
    const session = await this.db.repos.sessions.findByTokenHash(hashOpaqueToken(accessToken));
    if (session) await this.db.repos.sessions.revoke(session.id);
  }

  async me(userId: string): Promise<unknown> {
    const user = await this.db.repos.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.db.repos.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new BadRequestException('Current password is incorrect.');
    }
    const policy = passwordMeetsPolicy(newPassword);
    if (!policy.ok) throw new BadRequestException(policy.reason);
    await this.db.repos.users.update(userId, { passwordHash: await hashPassword(newPassword), mustChangePassword: false });
    await this.db.repos.sessions.revokeAllForUser(userId);
  }

  async setupTotp(userId: string): Promise<unknown> {
    const user = await this.db.repos.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const secret = generateTotpSecret();
    const recoveryCodes = generateRecoveryCodes(10);
    const hashed = recoveryCodes.map((c) => hashOpaqueToken(c));
    await this.db.repos.users.update(userId, { totpSecretEnc: secret, recoveryCodesHash: JSON.stringify(hashed) });
    return {
      secret,
      otpauthUrl: totpUri(secret, user.username, this.config.config?.api?.baseUrl ? 'FICMS' : 'FICMS'),
      recoveryCodes
    };
  }

  async confirmTotp(userId: string, code: string): Promise<void> {
    const user = await this.db.repos.users.findById(userId);
    if (!user || !user.totpSecretEnc) throw new BadRequestException('Two-factor setup not started.');
    if (!verifyTotp(user.totpSecretEnc, code, this.config.security.totpWindow)) {
      throw new BadRequestException('Invalid verification code.');
    }
    await this.db.repos.users.update(userId, { twoFactorEnabled: true });
  }

  async disableTotp(userId: string, code: string, password: string): Promise<void> {
    const user = await this.db.repos.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!(await verifyPassword(user.passwordHash, password))) throw new BadRequestException('Password is incorrect.');
    if (!user.totpSecretEnc || !verifyTotp(user.totpSecretEnc, code, this.config.security.totpWindow)) {
      throw new BadRequestException('Invalid verification code.');
    }
    await this.db.repos.users.update(userId, { twoFactorEnabled: false, totpSecretEnc: null, recoveryCodesHash: null });
  }

  async recoverWithCode(code: string, newPassword: string): Promise<void> {
    // Find a user whose stored recovery-code hash matches.
    const users = await this.db.repos.users.list();
    const digest = hashOpaqueToken(code.trim().toUpperCase());
    let matched: { id: string; recoveryCodesHash: string | null } | undefined;
    for (const u of users) {
      if (!u.recoveryCodesHash) continue;
      try {
        const hashes: string[] = JSON.parse(u.recoveryCodesHash);
        if (hashes.some((h) => safeEqual(h, digest))) {
          matched = { id: u.id, recoveryCodesHash: u.recoveryCodesHash };
          break;
        }
      } catch {
        /* ignore malformed */
      }
    }
    if (!matched) throw new UnauthorizedException('Invalid recovery code.');
    const policy = passwordMeetsPolicy(newPassword);
    if (!policy.ok) throw new BadRequestException(policy.reason);
    const remaining = (JSON.parse(matched.recoveryCodesHash ?? '[]') as string[]).filter((h) => !safeEqual(h, digest));
    await this.db.repos.users.update(matched.id, {
      passwordHash: await hashPassword(newPassword),
      recoveryCodesHash: JSON.stringify(remaining),
      twoFactorEnabled: false,
      totpSecretEnc: null,
      failedLogins: 0,
      lockedUntil: null
    });
    await this.db.repos.sessions.revokeAllForUser(matched.id);
  }

  private async registerFailedLogin(userId: string): Promise<void> {
    const user = await this.db.repos.users.findById(userId);
    if (!user) return;
    const max = this.config.security.accountLockoutMax;
    const failed = (user.failedLogins ?? 0) + 1;
    const lockedUntil = failed >= max ? new Date(Date.now() + this.config.security.loginThrottleWindowSeconds * 1000).toISOString() : null;
    await this.db.repos.users.update(userId, { failedLogins: failed, lockedUntil });
  }

  private publicUser(user: NonNullable<Awaited<ReturnType<DatabaseService['repos']['users']['findById']>>>): unknown {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles ?? [],
      permissions: user.permissions ?? [],
      mustChangePassword: !!user.mustChangePassword,
      twoFactorEnabled: !!user.twoFactorEnabled,
      branchId: user.branchId,
      departmentId: user.departmentId,
      jobTitle: user.jobTitle
    };
  }
}
