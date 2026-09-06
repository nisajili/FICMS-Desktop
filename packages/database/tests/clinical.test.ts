import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, seedBase } from './helpers';
import type { Repositories } from '../src/repository/index';

describe('Clinical records (versioned EMR)', () => {
  let repos: Repositories;
  let adminId: string;
  let patientId: string;

  beforeEach(async () => {
    ({ repos } = await makeTestDb());
    ({ adminId, patientId } = await seedBase(repos));
  });

  it('updates a draft in place and keeps a version history', async () => {
    const record = await repos.clinical.create({ patientId, kind: 'CONSULTATION', body: { note: 'v1' }, authorId: adminId });
    await repos.clinical.update({ id: record.id, body: { note: 'v2' }, editorId: adminId, editorPermissions: ['*'] });
    const versions = await repos.clinical.versions(record.id);
    expect(versions).toHaveLength(1); // previous snapshot
    const fresh = await repos.clinical.findById(record.id);
    expect(fresh?.version).toBe(2);
  });

  it('immutably supersedes a signed record on correction', async () => {
    const record = await repos.clinical.create({ patientId, kind: 'PROCEDURE', body: { note: 'signed body' }, authorId: adminId });
    await repos.clinical.sign(record.id, adminId, 'digest-1');
    const updated = await repos.clinical.update({
      id: record.id,
      body: { note: 'corrected' },
      editorId: adminId,
      editorPermissions: ['*'],
      reason: 'correction'
    });
    expect(updated.id).not.toBe(record.id);
    expect(updated.supersedesId).toBe(record.id);
    const original = await repos.clinical.findById(record.id);
    expect(original?.archivedAt).toBeTruthy();
    expect(original?.body).toContain('signed body'); // unchanged
  });

  it('prevents a non-author clinician from editing a draft', async () => {
    const author = await repos.users.create({ username: 'doctor', fullName: 'Doctor', passwordHash: 'x', roleIds: [] });
    const record = await repos.clinical.create({ patientId, kind: 'CONSULTATION', body: { note: 'x' }, authorId: author.id });
    await expect(
      repos.clinical.update({
        id: record.id,
        body: { note: 'hijack' },
        editorId: adminId,
        editorPermissions: ['clinical_record:update', 'clinical_record:correct']
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
