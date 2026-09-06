import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, seedBase } from './helpers';
import type { Repositories } from '../src/repository/index';
import type { SqliteEngine } from '../src/engine/types';

describe('Cryobank', () => {
  let engine: SqliteEngine;
  let repos: Repositories;
  let adminId: string;
  let witnessId: string;
  let patientId: string;
  let positionId: string;

  beforeEach(async () => {
    ({ engine, repos } = await makeTestDb());
    ({ adminId, patientId } = await seedBase(repos));
    const witness = await repos.users.create({ username: 'witness', fullName: 'Witness', passwordHash: 'x', roleIds: [] });
    witnessId = witness.id;
    // Build a minimal hierarchy.
    const facilityId = crypto.randomUUID();
    await engine.run(`INSERT INTO cryo_facilities (id, name) VALUES (?, 'F')`, [facilityId]);
    const roomId = crypto.randomUUID();
    await engine.run(`INSERT INTO cryo_rooms (id, facility_id, name) VALUES (?, ?, 'R')`, [roomId, facilityId]);
    const tankId = crypto.randomUUID();
    await engine.run(`INSERT INTO cryo_tanks (id, room_id, name, status, capacity_slots) VALUES (?, ?, 'TANK', 'IN_SERVICE', 10)`, [tankId, roomId]);
    const canId = crypto.randomUUID();
    await engine.run(`INSERT INTO cryo_canisters (id, tank_id, name) VALUES (?, ?, 'CAN')`, [canId, tankId]);
    const caneId = crypto.randomUUID();
    await engine.run(`INSERT INTO cryo_canes (id, canister_id, name) VALUES (?, ?, 'CANE')`, [caneId, canId]);
    const gobId = crypto.randomUUID();
    await engine.run(`INSERT INTO cryo_goblets (id, cane_id, name) VALUES (?, ?, 'GOB')`, [gobId, caneId]);
    const rackId = crypto.randomUUID();
    await engine.run(`INSERT INTO cryo_racks (id, goblet_id, name) VALUES (?, ?, 'RACK')`, [rackId, gobId]);
    positionId = crypto.randomUUID();
    await engine.run(`INSERT INTO cryo_positions (id, rack_id, row, column, path) VALUES (?, ?, 1, 1, 'TANK/CAN/CANE/GOB/RACK/R1C1')`, [positionId, rackId]);
  });

  it('stores an item when double-witness is provided', async () => {
    const id = await repos.cryo.store({
      barcode: 'CRYO-001',
      entityType: 'EMBRYO',
      patientId,
      positionId,
      freezeAt: new Date().toISOString(),
      primaryUserId: adminId,
      witnessUserId: witnessId
    });
    expect(id).toBeTruthy();
    const items = await repos.cryo.items({ patientId });
    expect(items).toHaveLength(1);
  });

  it('rejects storing without a distinct witness', async () => {
    await expect(
      repos.cryo.store({
        barcode: 'CRYO-002',
        entityType: 'EMBRYO',
        patientId,
        positionId,
        freezeAt: new Date().toISOString(),
        primaryUserId: adminId,
        witnessUserId: adminId // same user
      })
    ).rejects.toMatchObject({ code: 'WITNESS_SAME_USER' });
  });

  it('prevents two active items from sharing a position', async () => {
    await repos.cryo.store({
      barcode: 'CRYO-A',
      entityType: 'EMBRYO',
      patientId,
      positionId,
      freezeAt: new Date().toISOString(),
      primaryUserId: adminId,
      witnessUserId: witnessId
    });
    await expect(
      repos.cryo.store({
        barcode: 'CRYO-B',
        entityType: 'EMBRYO',
        patientId,
        positionId,
        freezeAt: new Date().toISOString(),
        primaryUserId: adminId,
        witnessUserId: witnessId
      })
    ).rejects.toMatchObject({ code: 'CRYO_POSITION_OCCUPIED' });
  });

  it('allows re-storing into a freed position after release', async () => {
    const itemId = await repos.cryo.store({
      barcode: 'CRYO-C',
      entityType: 'EMBRYO',
      patientId,
      positionId,
      freezeAt: new Date().toISOString(),
      primaryUserId: adminId,
      witnessUserId: witnessId
    });
    await repos.cryo.releaseOrDispose(itemId, 'RELEASED', adminId, witnessId);
    const id2 = await repos.cryo.store({
      barcode: 'CRYO-D',
      entityType: 'EMBRYO',
      patientId,
      positionId,
      freezeAt: new Date().toISOString(),
      primaryUserId: adminId,
      witnessUserId: witnessId
    });
    expect(id2).toBeTruthy();
  });
});
