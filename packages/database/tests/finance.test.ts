import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, seedBase } from './helpers';
import type { Repositories } from '../src/repository/index';

describe('Finance & billing', () => {
  let repos: Repositories;
  let adminId: string;
  let patientId: string;

  beforeEach(async () => {
    ({ repos } = await makeTestDb());
    ({ adminId, patientId } = await seedBase(repos));
  });

  it('computes invoice totals from lines', async () => {
    const service = await repos.services.create({ code: 'S1', name: 'Service 1', priceMinor: 10000 });
    const invoiceId = await repos.finance.createInvoice({
      number: 'INV-00001',
      patientId,
      lines: [{ serviceId: service, description: 'Service 1', quantity: 2, unitPriceMinor: 10000, discountMinor: 0, taxRate: 0 }]
    });
    const invoice = await repos.finance.getInvoice(invoiceId);
    expect(invoice?.grand_total_minor).toBe(20000);
  });

  it('records a partial payment and updates the balance', async () => {
    const service = await repos.services.create({ code: 'S2', name: 'Service 2', priceMinor: 100000 });
    const invoiceId = await repos.finance.createInvoice({
      number: 'INV-00002',
      patientId,
      lines: [{ serviceId: service, description: 'Service 2', quantity: 1, unitPriceMinor: 100000, discountMinor: 0, taxRate: 0 }]
    });
    await repos.finance.issueInvoice(invoiceId);
    await repos.finance.recordPayment({
      invoiceId,
      amountMinor: 40000,
      method: 'CASH',
      idempotencyKey: 'pay-1',
      recordedById: adminId
    });
    const invoice = await repos.finance.getInvoice(invoiceId);
    expect(invoice?.status).toBe('PARTIALLY_PAID');
    expect(invoice?.paid_total_minor).toBe(40000);
  });

  it('never double-applies a payment with the same idempotency key', async () => {
    const service = await repos.services.create({ code: 'S3', name: 'Service 3', priceMinor: 50000 });
    const invoiceId = await repos.finance.createInvoice({
      number: 'INV-00003',
      patientId,
      lines: [{ serviceId: service, description: 'Service 3', quantity: 1, unitPriceMinor: 50000, discountMinor: 0, taxRate: 0 }]
    });
    await repos.finance.issueInvoice(invoiceId);
    const first = await repos.finance.recordPayment({ invoiceId, amountMinor: 50000, method: 'CASH', idempotencyKey: 'dup-key', recordedById: adminId });
    const second = await repos.finance.recordPayment({ invoiceId, amountMinor: 50000, method: 'CASH', idempotencyKey: 'dup-key', recordedById: adminId });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    const invoice = await repos.finance.getInvoice(invoiceId);
    expect(invoice?.paid_total_minor).toBe(50000);
  });

  it('rejects overpayment', async () => {
    const service = await repos.services.create({ code: 'S4', name: 'Service 4', priceMinor: 10000 });
    const invoiceId = await repos.finance.createInvoice({
      number: 'INV-00004',
      patientId,
      lines: [{ serviceId: service, description: 'Service 4', quantity: 1, unitPriceMinor: 10000, discountMinor: 0, taxRate: 0 }]
    });
    await repos.finance.issueInvoice(invoiceId);
    await expect(
      repos.finance.recordPayment({ invoiceId, amountMinor: 20000, method: 'CASH', idempotencyKey: 'over', recordedById: adminId })
    ).rejects.toMatchObject({ code: 'OVERPAYMENT' });
  });
});
