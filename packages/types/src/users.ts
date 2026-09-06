import type { ID, ISODateTime } from './common';
import type { Role } from './auth';

export interface UserSummary {
  id: ID;
  username: string;
  fullName: string;
  email?: string;
  roles: Role[];
  active: boolean;
  branchId?: string | null;
  departmentId?: string | null;
  jobTitle?: string;
  lastLoginAt?: ISODateTime;
}

export interface UserDetail extends UserSummary {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  twoFactorEnabled: boolean;
  mfaConfigured: boolean;
  mustChangePassword: boolean;
  licenseExpiryAt?: ISODateTime;
}

export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  roleKeys: Role[];
  branchId?: string | null;
  departmentId?: string | null;
  jobTitle?: string;
  mustChangePassword?: boolean;
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string;
  roleKeys?: Role[];
  active?: boolean;
  branchId?: string | null;
  departmentId?: string | null;
  jobTitle?: string;
  mustChangePassword?: boolean;
}
