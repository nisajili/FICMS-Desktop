import type { SqlEngine } from '../engine/types';
import type { Permission, Role } from '@ficms/types';
import { permissionsForRoles } from '@ficms/domain';
import { newId, nowIso, FicmsError, notFound, json, parse, bool } from './base';

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  passwordHash: string;
  mustChangePassword: number;
  active: number;
  twoFactorEnabled: number;
  totpSecretEnc: string | null;
  recoveryCodesHash: string | null;
  failedLogins: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  jobTitle: string | null;
  licenseExpiryAt: string | null;
  branchId: string | null;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
  roles?: string[];
  permissions?: Permission[];
}

export interface RoleRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  permissions: string;
  system: number;
  createdAt: string;
}

export interface CreateUserData {
  username: string;
  email?: string | null;
  fullName: string;
  passwordHash: string;
  mustChangePassword?: boolean;
  jobTitle?: string;
  branchId?: string | null;
  departmentId?: string | null;
  roleIds: string[];
}

const USER_SELECT = `SELECT id, username, email, full_name AS fullName, password_hash AS passwordHash,
  must_change_password AS mustChangePassword, active, two_factor_enabled AS twoFactorEnabled,
  totp_secret_enc AS totpSecretEnc, recovery_codes_hash AS recoveryCodesHash,
  failed_logins AS failedLogins, locked_until AS lockedUntil, last_login_at AS lastLoginAt,
  job_title AS jobTitle, license_expiry_at AS licenseExpiryAt, branch_id AS branchId,
  department_id AS departmentId, created_at AS createdAt, updated_at AS updatedAt FROM users`;

export class UserRepository {
  constructor(private readonly db: SqlEngine) {}

  async findById(id: string): Promise<UserRow | undefined> {
    const row = await this.db.get<UserRow>(`${USER_SELECT} WHERE id = ?`, [id]);
    if (!row) return undefined;
    return this.hydrate(row);
  }

  async findByUsername(username: string): Promise<UserRow | undefined> {
    const row = await this.db.get<UserRow>(`${USER_SELECT} WHERE username = ?`, [username]);
    if (!row) return undefined;
    return this.hydrate(row);
  }

  private async hydrate(row: UserRow): Promise<UserRow> {
    const roles = await this.db.all<{ key: string }>(
      `SELECT r.key FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?`,
      [row.id]
    );
    row.roles = roles.map((r) => r.key as Role);
    row.permissions = permissionsForRoles(row.roles as Role[]);
    return row;
  }

  async list(where = '', params: unknown[] = []): Promise<UserRow[]> {
    const rows = await this.db.all<UserRow>(`${USER_SELECT} ${where} ORDER BY full_name`, params);
    return Promise.all(rows.map((r) => this.hydrate(r)));
  }

  async create(data: CreateUserData): Promise<UserRow> {
    const id = newId();
    const now = nowIso();
    const user: UserRow = {
      id,
      username: data.username,
      email: data.email ?? null,
      fullName: data.fullName,
      passwordHash: data.passwordHash,
      mustChangePassword: data.mustChangePassword ? 1 : 0,
      active: 1,
      twoFactorEnabled: 0,
      totpSecretEnc: null,
      recoveryCodesHash: null,
      failedLogins: 0,
      lockedUntil: null,
      lastLoginAt: null,
      jobTitle: data.jobTitle ?? null,
      licenseExpiryAt: null,
      branchId: data.branchId ?? null,
      departmentId: data.departmentId ?? null,
      createdAt: now,
      updatedAt: now
    };
    await this.db.run(
      `INSERT INTO users (id, username, email, full_name, password_hash, must_change_password, active, two_factor_enabled, failed_logins, job_title, branch_id, department_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?, ?, ?)`,
      [id, user.username, user.email, user.fullName, user.passwordHash, user.mustChangePassword, user.jobTitle, user.branchId, user.departmentId, now, now]
    );
    for (const roleId of data.roleIds) {
      await this.db.run(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [id, roleId]);
    }
    return this.hydrate(user);
  }

  async update(
    id: string,
    patch: {
      fullName?: string;
      email?: string | null;
      active?: boolean | number;
      jobTitle?: string | null;
      branchId?: string | null;
      departmentId?: string | null;
      mustChangePassword?: boolean | number;
      twoFactorEnabled?: boolean | number;
      totpSecretEnc?: string | null;
      recoveryCodesHash?: string | null;
      failedLogins?: number;
      lockedUntil?: string | null;
      lastLoginAt?: string | null;
      licenseExpiryAt?: string | null;
      passwordHash?: string;
    }
  ): Promise<UserRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const col = this.columnFor(key);
      sets.push(`${col} = ?`);
      params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
    if (sets.length === 0) return (await this.findById(id))!;
    sets.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);
    await this.db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    return (await this.findById(id))!;
  }

  private columnFor(key: string): string {
    const map: Record<string, string> = {
      fullName: 'full_name',
      email: 'email',
      active: 'active',
      jobTitle: 'job_title',
      branchId: 'branch_id',
      departmentId: 'department_id',
      mustChangePassword: 'must_change_password',
      twoFactorEnabled: 'two_factor_enabled',
      totpSecretEnc: 'totp_secret_enc',
      recoveryCodesHash: 'recovery_codes_hash',
      failedLogins: 'failed_logins',
      lockedUntil: 'locked_until',
      lastLoginAt: 'last_login_at',
      licenseExpiryAt: 'license_expiry_at',
      passwordHash: 'password_hash'
    };
    return map[key] ?? key;
  }

  async setRoles(id: string, roleIds: string[]): Promise<void> {
    await this.db.run(`DELETE FROM user_roles WHERE user_id = ?`, [id]);
    for (const roleId of roleIds) {
      await this.db.run(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [id, roleId]);
    }
  }
}

export class RoleRepository {
  constructor(private readonly db: SqlEngine) {}

  async all(): Promise<RoleRow[]> {
    return this.db.all<RoleRow>(`SELECT * FROM roles ORDER BY key`);
  }

  async findByKey(key: string): Promise<RoleRow | undefined> {
    return this.db.get<RoleRow>(`SELECT * FROM roles WHERE key = ?`, [key]);
  }

  async findById(id: string): Promise<RoleRow | undefined> {
    return this.db.get<RoleRow>(`SELECT * FROM roles WHERE id = ?`, [id]);
  }

  async create(data: { key: string; label: string; description?: string | null; permissions: Permission[]; system?: boolean }): Promise<RoleRow> {
    const id = newId();
    const role: RoleRow = {
      id,
      key: data.key,
      label: data.label,
      description: data.description ?? null,
      permissions: json(data.permissions),
      system: data.system ? 1 : 0,
      createdAt: nowIso()
    };
    await this.db.run(
      `INSERT INTO roles (id, key, label, description, permissions, system, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, role.key, role.label, role.description, role.permissions, role.system, role.createdAt]
    );
    return role;
  }

  async upsertByKey(data: { key: string; label: string; description?: string | null; permissions: Permission[]; system?: boolean }): Promise<RoleRow> {
    const existing = await this.findByKey(data.key);
    if (existing) {
      await this.db.run(
        `UPDATE roles SET label = ?, description = ?, permissions = ?, system = ? WHERE key = ?`,
        [data.label, data.description ?? null, json(data.permissions), data.system ? 1 : 0, data.key]
      );
      return (await this.findByKey(data.key))!;
    }
    return this.create(data);
  }

  async update(id: string, patch: { label?: string; description?: string | null; permissions?: Permission[] }): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.label !== undefined) {
      sets.push('label = ?');
      params.push(patch.label);
    }
    if (patch.description !== undefined) {
      sets.push('description = ?');
      params.push(patch.description);
    }
    if (patch.permissions !== undefined) {
      sets.push('permissions = ?');
      params.push(json(patch.permissions));
    }
    if (sets.length) {
      params.push(id);
      await this.db.run(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, params);
    }
  }

  async remove(id: string): Promise<void> {
    const role = await this.findById(id);
    if (!role) throw notFound('Role', id);
    if (bool(role.system)) throw new FicmsError('SYSTEM_ROLE', 'System roles cannot be deleted.', 409);
    await this.db.run(`DELETE FROM roles WHERE id = ?`, [id]);
  }
}

export class SessionRepository {
  constructor(private readonly db: SqlEngine) {}

  async create(data: { userId: string; tokenHash: string; refreshHash?: string | null; ip?: string | null; userAgent?: string | null; deviceKind?: string; expiresAt: string }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO sessions (id, user_id, token_hash, refresh_hash, ip, user_agent, device_kind, expires_at, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.userId, data.tokenHash, data.refreshHash ?? null, data.ip ?? null, data.userAgent ?? null, data.deviceKind ?? 'desktop', data.expiresAt, nowIso(), nowIso()]
    );
    return id;
  }

  async findByTokenHash(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: string; revokedAt: string | null } | undefined> {
    return this.db.get(`SELECT id, user_id AS userId, expires_at AS expiresAt, revoked_at AS revokedAt FROM sessions WHERE token_hash = ?`, [tokenHash]);
  }

  async revoke(id: string): Promise<void> {
    await this.db.run(`UPDATE sessions SET revoked_at = ? WHERE id = ?`, [nowIso(), id]);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.run(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [nowIso(), userId]);
  }

  async purgeExpired(): Promise<number> {
    const res = await this.db.run(`DELETE FROM sessions WHERE expires_at < ? OR revoked_at IS NOT NULL`, [nowIso()]);
    return res.changes;
  }

  async touch(id: string): Promise<void> {
    await this.db.run(`UPDATE sessions SET last_active_at = ? WHERE id = ?`, [nowIso(), id]);
  }
}

/** Parse permissions JSON stored on a role. */
export function rolePermissions(row: RoleRow): Permission[] {
  return parse<Permission[]>(row.permissions, []);
}
