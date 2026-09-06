import { Injectable } from '@nestjs/common';
import { newIdempotencyKey } from '@ficms/domain';
import { DatabaseService } from '../../common/database.service';

@Injectable()
export class FinanceService {
  constructor(private readonly db: DatabaseService) {}

  async createInvoice(input: {
    patientId: string;
    currency?: string;
    lines: { serviceId: string; description: string; quantity: number; unitPriceMinor: number; discountMinor: number; taxRate: number }[];
    dueDate?: string | null;
  }) {
    const number = await this.db.repos.settings.nextNumber('invoice', 'INV-', 5);
    const id = await this.db.repos.finance.createInvoice({ ...input, number });
    return { id, number };
  }

  async getInvoice(id: string) {
    return this.db.repos.finance.getInvoice(id);
  }

  async listInvoices(opts: { patientId?: string; status?: string }) {
    return this.db.repos.finance.listInvoices(opts);
  }

  async issue(id: string) {
    await this.db.repos.finance.issueInvoice(id);
    return { ok: true };
  }

  async recordPayment(input: { invoiceId: string; amountMinor: number; method: string; reference?: string | null; idempotencyKey?: string | null }, userId: string) {
    const idempotencyKey = input.idempotencyKey ?? newIdempotencyKey();
    const result = await this.db.repos.finance.recordPayment({
      invoiceId: input.invoiceId,
      amountMinor: input.amountMinor,
      method: input.method,
      reference: input.reference,
      idempotencyKey,
      recordedById: userId
    });
    return { ...result, idempotencyKey };
  }

  async voidPayment(id: string) {
    await this.db.repos.finance.voidPayment(id, '');
    return { ok: true };
  }

  async creditNote(input: { invoiceId: string; amountMinor: number; reason: string }) {
    const number = `CN-${Date.now()}`;
    return { id: await this.db.repos.finance.creditNote({ ...input, number }) };
  }

  async voidInvoice(id: string, reason: string) {
    await this.db.repos.finance.voidInvoice(id, reason);
    return { ok: true };
  }

  async addInstallment(invoiceId: string, dueDate: string, amountMinor: number) {
    return { id: await this.db.repos.finance.addInstallment(invoiceId, dueDate, amountMinor) };
  }

  async openShift(userId: string, openingFloatMinor: number) {
    return { id: await this.db.repos.finance.openShift(userId, openingFloatMinor) };
  }

  async closeShift(shiftId: string, closingCashMinor: number) {
    return this.db.repos.finance.closeShift(shiftId, closingCashMinor);
  }

  async revenue(): Promise<unknown> {
    const rows = await this.db.repos.finance.listInvoices({});
    let billed = 0;
    let collected = 0;
    const byMethod = new Map<string, number>();
    for (const row of rows) {
      billed += Number(row.grand_total_minor ?? 0);
      collected += Number(row.paid_total_minor ?? 0);
      const payments = await this.db.repos.finance.getInvoice(row.id as string);
      for (const p of (payments?.payments as { method: string; amount_minor: number }[] | undefined) ?? []) {
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount_minor));
      }
    }
    return {
      billedTotalMinor: billed,
      collectedTotalMinor: collected,
      outstandingMinor: billed - collected,
      byMethod: Object.fromEntries(byMethod)
    };
  }
}
