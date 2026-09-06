import { BadRequestException, Injectable } from '@nestjs/common';
import { hashPassword, passwordMeetsPolicy } from '@ficms/security';
import { rolePermissions } from '@ficms/database';
import type { Permission } from '@ficms/types';
import { DatabaseService } from '../../common/database.service';
import { notFound, FicmsError } from '@ficms/database';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const users = await this.db.repos.users.list();
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      active: !!u.active,
      roles: u.roles ?? [],
      twoFactorEnabled: !!u.twoFactorEnabled,
      mustChangePassword: !!u.mustChangePassword,
      branchId: u.branchId,
      departmentId: u.departmentId,
      jobTitle: u.jobTitle,
      lastLoginAt: u.lastLoginAt,
      licenseExpiryAt: u.licenseExpiryAt
    }));
  }

  async create(input: {
    username: string;
    password: string;
    fullName: string;
    email?: string | null;
    roleKeys: string[];
    branchId?: string | null;
    departmentId?: string | null;
    jobTitle?: string | null;
    mustChangePassword?: boolean;
  }) {
    const policy = passwordMeetsPolicy(input.password);
    if (!policy.ok) throw new BadRequestException(policy.reason);
    const existing = await this.db.repos.users.findByUsername(input.username);
    if (existing) throw new FicmsError('USERNAME_TAKEN', 'Username is already in use.', 409);
    const roleIds: string[] = [];
    for (const key of input.roleKeys) {
      const role = await this.db.repos.roles.findByKey(key);
      if (!role) throw new BadRequestException(`Unknown role: ${key}`);
      roleIds.push(role.id);
    }
    const user = await this.db.repos.users.create({
      username: input.username,
      fullName: input.fullName,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      mustChangePassword: input.mustChangePassword ?? true,
      jobTitle: input.jobTitle ?? undefined,
      branchId: input.branchId,
      departmentId: input.departmentId,
      roleIds
    });
    return { id: user.id, username: user.username, fullName: user.fullName, roles: user.roles };
  }

  async update(id: string, patch: {
    fullName?: string;
    email?: string | null;
    roleKeys?: string[];
    active?: boolean;
    branchId?: string | null;
    departmentId?: string | null;
    jobTitle?: string | null;
    mustChangePassword?: boolean;
  }) {
    const user = await this.db.repos.users.findById(id);
    if (!user) throw notFound('User', id);
    const dbPatch: Record<string, unknown> = {};
    if (patch.fullName !== undefined) dbPatch.fullName = patch.fullName;
    if (patch.email !== undefined) dbPatch.email = patch.email;
    if (patch.active !== undefined) dbPatch.active = patch.active;
    if (patch.branchId !== undefined) dbPatch.branchId = patch.branchId;
    if (patch.departmentId !== undefined) dbPatch.departmentId = patch.departmentId;
    if (patch.jobTitle !== undefined) dbPatch.jobTitle = patch.jobTitle;
    if (patch.mustChangePassword !== undefined) dbPatch.mustChangePassword = patch.mustChangePassword;
    await this.db.repos.users.update(id, dbPatch as never);
    if (patch.roleKeys) {
      const roleIds: string[] = [];
      for (const key of patch.roleKeys) {
        const role = await this.db.repos.roles.findByKey(key);
        if (!role) throw new BadRequestException(`Unknown role: ${key}`);
        roleIds.push(role.id);
      }
      await this.db.repos.users.setRoles(id, roleIds);
    }
    return (await this.db.repos.users.findById(id))!;
  }

  async roles() {
    const roles = await this.db.repos.roles.all();
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      description: r.description,
      permissions: rolePermissions(r),
      system: !!r.system
    }));
  }

  async updateRole(id: string, patch: { label?: string; description?: string | null; permissions?: string[] }) {
    const role = await this.db.repos.roles.findById(id);
    if (!role) throw notFound('Role', id);
    await this.db.repos.roles.update(id, { label: patch.label, description: patch.description, permissions: patch.permissions as Permission[] });
    return this.db.repos.roles.findById(id);
  }
}
