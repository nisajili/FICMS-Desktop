import { describe, it, expect } from 'vitest';
import { openDatabase, Repositories } from '@ficms/database';
import { hashOpaqueToken } from '@ficms/security';
import { runMaintenance } from '../src/maintenance';

describe('worker maintenance', () => {
  it('purges expired sessions and reports integrity', async () => {
    const db = await openDatabase({ url: 'file::memory:' });
    const repos = new Repositories(db.engine);

    const role = await repos.roles.upsertByKey({ key: 'SYSTEM_ADMINISTRATOR', label: 'System Administrator', permissions: ['*'], system: true });
    const user = await repos.users.create({ username: 'worker-admin', fullName: 'Worker', passwordHash: 'x', roleIds: [role.id] });
    await repos.sessions.create({
      userId: user.id,
      tokenHash: hashOpaqueToken('expired-token'),
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    });
    await repos.sessions.create({
      userId: user.id,
      tokenHash: hashOpaqueToken('active-token'),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });

    const report = await runMaintenance(repos, db);
    expect(report.integrity.ok).toBe(true);
    expect(report.purgedSessions).toBe(1);

    await db.close();
  });
});
