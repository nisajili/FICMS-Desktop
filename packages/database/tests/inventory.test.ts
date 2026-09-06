import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, seedBase } from './helpers';
import type { Repositories } from '../src/repository/index';

describe('Inventory', () => {
  let repos: Repositories;
  let adminId: string;

  beforeEach(async () => {
    ({ repos } = await makeTestDb());
    ({ adminId } = await seedBase(repos));
  });

  it('decrements stock transactionally and rejects negative stock', async () => {
    const medId = await repos.medications.create({ code: 'M1', name: 'Med 1' });
    const stockId = await repos.inventory.createStockItem({ medicationId: medId, batchNumber: 'B1', quantityOnHand: 10 });
    await repos.inventory.movement({ stockItemId: stockId, type: 'ISSUE', quantity: 4, performedById: adminId });
    const item = await repos.inventory.findStockItem(stockId);
    expect(item?.quantity_on_hand).toBe(6);
    await expect(
      repos.inventory.movement({ stockItemId: stockId, type: 'ISSUE', quantity: 100, performedById: adminId })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  });

  it('ignores duplicate stock movements by idempotency key', async () => {
    const medId = await repos.medications.create({ code: 'M2', name: 'Med 2' });
    const stockId = await repos.inventory.createStockItem({ medicationId: medId, batchNumber: 'B2', quantityOnHand: 20 });
    const key = 'mov-1';
    await repos.inventory.movement({ stockItemId: stockId, type: 'RECEIPT', quantity: 5, performedById: adminId, idempotencyKey: key });
    await repos.inventory.movement({ stockItemId: stockId, type: 'RECEIPT', quantity: 5, performedById: adminId, idempotencyKey: key });
    const item = await repos.inventory.findStockItem(stockId);
    expect(item?.quantity_on_hand).toBe(25);
  });

  it('issues stock using FEFO order', async () => {
    const medId = await repos.medications.create({ code: 'M3', name: 'Med 3' });
    const early = await repos.inventory.createStockItem({ medicationId: medId, batchNumber: 'EARLY', quantityOnHand: 5, expiryDate: '2026-01-01' });
    const late = await repos.inventory.createStockItem({ medicationId: medId, batchNumber: 'LATE', quantityOnHand: 5, expiryDate: '2027-01-01' });
    await repos.inventory.issueFefo(medId, 6, adminId);
    const earlyItem = await repos.inventory.findStockItem(early);
    const lateItem = await repos.inventory.findStockItem(late);
    expect(earlyItem?.quantity_on_hand).toBe(0);
    expect(lateItem?.quantity_on_hand).toBe(4);
  });
});
