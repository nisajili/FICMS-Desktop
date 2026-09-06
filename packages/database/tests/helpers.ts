import { createSqliteEngine } from '../src/engine/sqlite';
import { migrate } from '../src/migrate/runner';
import { Repositories } from '../src/repository/index';
import type { SqliteEngine } from '../src/engine/types';

export async function makeTestDb(): Promise<{ engine: SqliteEngine; repos: Repositories }> {
  const engine = await createSqliteEngine({ filePath: ':memory:' });
  await migrate(engine);
  return { engine, repos: new Repositories(engine) };
}

export async function seedBase(repos: Repositories): Promise<{ adminId: string; patientId: string }> {
  // Minimal role + user + patient fixtures used across tests.
  const role = await repos.roles.upsertByKey({ key: 'SYSTEM_ADMINISTRATOR', label: 'System Administrator', permissions: ['*'], system: true });
  const admin = await repos.users.create({
    username: 'admin',
    fullName: 'Admin',
    passwordHash: 'x',
    roleIds: [role.id]
  });
  const patient = await repos.patients.create({
    mrn: 'MRN-00001',
    firstName: 'Jane',
    lastName: 'Doe',
    sex: 'FEMALE'
  });
  return { adminId: admin.id, patientId: patient.id };
}
