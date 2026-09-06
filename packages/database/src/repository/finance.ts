import type { SqlEngine } from '../engine/types';
import { newId, nowIso, notFound, conflict, FicmsError, bool } from './base';
import { lineTotals, assertPaymentAmount, round2 } from '@ficms/domain';

export interface InvoiceLineInput {
  serviceId: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxRate: number;
}

export class FinanceRepository {
  constructor(private readonly db: SqlEngine) {}

  async createInvoice(data: {
    number: string;
    patientId: string;
    currency?: string;
    lines: InvoiceLineInput[];
    dueDate?: string | null;
  }): Promise<string> {
    const now = nowIso();
    let subTotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;
    const computedLines = data.lines.map((l) => {
      const t = lineTotals({ unitPrice: l.unitPriceMinor / 100, quantity: l.quantity, discountAmount: l.discountMinor / 100, taxRate: l.taxRate });
      const totals = {
        grossMinor: Math.round(t.gross * 100),
        discountMinor: Math.round(t.discountAmount * 100),
        taxMinor: Math.round(t.taxAmount * 100),
        lineTotalMinor: Math.round(t.lineTotal * 100)
      };
      subTotal += totals.grossMinor;
      discountTotal += totals.discountMinor;
      taxTotal += totals.taxMinor;
      grandTotal += totals.lineTotalMinor;
      return { line: l, totals };
    });

    const id = newId();
    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO invoices (id, number, patient_id, status, sub_total_minor, discount_total_minor, tax_total_minor, grand_total_minor, paid_total_minor, currency, due_date, created_at, updated_at)
         VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [id, data.number, data.patientId, subTotal, discountTotal, taxTotal, grandTotal, data.currency ?? 'USD', data.dueDate ?? null, now, now]
      );
      for (const { line, totals } of computedLines) {
        await tx.run(
          `INSERT INTO invoice_lines (id, invoice_id, service_id, description, quantity, unit_price_minor, discount_minor, tax_minor, line_total_minor)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), id, line.serviceId, line.description, line.quantity, line.unitPriceMinor, totals.discountMinor, totals.taxMinor, totals.lineTotalMinor]
        );
      }
    });
    return id;
  }

  async getInvoice(id: string): Promise<Record<string, unknown> | undefined> {
    const invoice = await this.db.get(`SELECT * FROM invoices WHERE id = ?`, [id]);
    if (!invoice) return undefined;
    const lines = await this.db.all(`SELECT * FROM invoice_lines WHERE invoice_id = ?`, [id]);
    const payments = await this.db.all(`SELECT * FROM payments WHERE invoice_id = ? AND voided = 0 ORDER BY received_at`, [id]);
    return { ...invoice, lines, payments };
  }

  async listInvoices(opts: { patientId?: string; status?: string } = {}): Promise<Record<string, unknown>[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts.patientId) {
      clauses.push('i.patient_id = ?');
      params.push(opts.patientId);
    }
    if (opts.status) {
      clauses.push('i.status = ?');
      params.push(opts.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db.all(
      `SELECT i.*, p.mrn AS patientMrn, p.first_name AS patientFirstName, p.last_name AS patientLastName
       FROM invoices i LEFT JOIN patients p ON p.id = i.patient_id ${where} ORDER BY i.created_at DESC`,
      params
    );
  }

  async issueInvoice(id: string): Promise<void> {
    const invoice = await this.db.get(`SELECT id, status FROM invoices WHERE id = ?`, [id]);
    if (!invoice) throw notFound('Invoice', id);
    await this.db.run(`UPDATE invoices SET status = 'ISSUED', issued_at = ?, updated_at = ? WHERE id = ?`, [nowIso(), nowIso(), id]);
  }

  /**
   * Record a payment idempotently. A duplicate idempotency key returns the
   * existing payment instead of double-applying, and the invoice balance is
   * updated inside the same transaction.
   */
  async recordPayment(data: { invoiceId: string; amountMinor: number; method: string; reference?: string | null; idempotencyKey: string; recordedById: string }): Promise<{ id: string; duplicate: boolean }> {
    const existing = await this.db.get<{ id: string }>(`SELECT id FROM payments WHERE idempotency_key = ?`, [data.idempotencyKey]);
    if (existing) return { id: existing.id, duplicate: true };

    return this.db.transaction(async (tx) => {
      const invoice = await tx.get<{ id: string; status: string; grand_total_minor: number; paid_total_minor: number }>(
        `SELECT id, status, grand_total_minor, paid_total_minor FROM invoices WHERE id = ?`,
        [data.invoiceId]
      );
      if (!invoice) throw notFound('Invoice', data.invoiceId);
      if (invoice.status === 'VOID') throw conflict('INVOICE_VOID', 'Cannot pay a void invoice.');

      const outstanding = invoice.grand_total_minor - invoice.paid_total_minor;
      const check = assertPaymentAmount(outstanding / 100, data.amountMinor / 100);
      if (!check.ok) throw new FicmsError(check.error.code, check.error.message, 422);

      const id = newId();
      await tx.run(
        `INSERT INTO payments (id, invoice_id, amount_minor, method, reference, idempotency_key, received_at, recorded_by_id, voided) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, data.invoiceId, data.amountMinor, data.method, data.reference ?? null, data.idempotencyKey, nowIso(), data.recordedById]
      );
      const paidTotal = invoice.paid_total_minor + data.amountMinor;
      const status = paidTotal >= invoice.grand_total_minor ? 'PAID' : 'PARTIALLY_PAID';
      await tx.run(`UPDATE invoices SET paid_total_minor = ?, status = ?, updated_at = ? WHERE id = ?`, [paidTotal, status, nowIso(), data.invoiceId]);
      return { id, duplicate: false };
    });
  }

  async voidPayment(id: string, _voidedById: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const payment = await tx.get<{ id: string; invoice_id: string; amount_minor: number; voided: number }>(`SELECT id, invoice_id, amount_minor, voided FROM payments WHERE id = ?`, [id]);
      if (!payment) throw notFound('Payment', id);
      if (bool(payment.voided)) return;
      await tx.run(`UPDATE payments SET voided = 1 WHERE id = ?`, [id]);
      const invoice = await tx.get<{ grand_total_minor: number; paid_total_minor: number }>(`SELECT grand_total_minor, paid_total_minor FROM invoices WHERE id = ?`, [payment.invoice_id]);
      if (invoice) {
        const paidTotal = Math.max(0, invoice.paid_total_minor - payment.amount_minor);
        const status = paidTotal <= 0 ? 'ISSUED' : paidTotal >= invoice.grand_total_minor ? 'PAID' : 'PARTIALLY_PAID';
        await tx.run(`UPDATE invoices SET paid_total_minor = ?, status = ?, updated_at = ? WHERE id = ?`, [paidTotal, status, nowIso(), payment.invoice_id]);
      }
    });
  }

  async creditNote(data: { invoiceId: string; number: string; amountMinor: number; reason: string }): Promise<string> {
    const invoice = await this.db.get(`SELECT id FROM invoices WHERE id = ?`, [data.invoiceId]);
    if (!invoice) throw notFound('Invoice', data.invoiceId);
    const id = newId();
    await this.db.run(`INSERT INTO credit_notes (id, invoice_id, number, amount_minor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [id, data.invoiceId, data.number, data.amountMinor, data.reason, nowIso()]);
    await this.db.run(`UPDATE invoices SET status = 'CREDITED', updated_at = ? WHERE id = ?`, [nowIso(), data.invoiceId]);
    return id;
  }

  async voidInvoice(id: string, reason: string): Promise<void> {
    await this.db.run(`UPDATE invoices SET status = 'VOID', void_reason = ?, updated_at = ? WHERE id = ?`, [reason, nowIso(), id]);
  }

  async addInstallment(invoiceId: string, dueDate: string, amountMinor: number): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO installments (id, invoice_id, due_date, amount_minor, status) VALUES (?, ?, ?, ?, 'PENDING')`, [id, invoiceId, dueDate, amountMinor]);
    return id;
  }

  // --- Cashier shifts ------------------------------------------------------

  async openShift(userId: string, openingFloatMinor: number): Promise<string> {
    const open = await this.db.get(`SELECT id FROM cashier_shifts WHERE user_id = ? AND status = 'OPEN'`, [userId]);
    if (open) throw conflict('SHIFT_OPEN', 'You already have an open shift.');
    const id = newId();
    await this.db.run(`INSERT INTO cashier_shifts (id, user_id, opened_at, opening_float_minor, status) VALUES (?, ?, ?, ?, 'OPEN')`, [id, userId, nowIso(), openingFloatMinor]);
    return id;
  }

  async closeShift(shiftId: string, closingCashMinor: number): Promise<{ expected: number; variance: number }> {
    const shift = await this.db.get<{ user_id: string; opening_float_minor: number; opened_at: string }>(
      `SELECT user_id, opening_float_minor, opened_at FROM cashier_shifts WHERE id = ? AND status = 'OPEN'`,
      [shiftId]
    );
    if (!shift) throw notFound('Open cashier shift', shiftId);
    const cashReceived = await this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM payments p WHERE p.recorded_by_id = ? AND p.voided = 0 AND p.received_at >= ? AND p.method = 'CASH'`,
      [shift.user_id, shift.opened_at]
    );
    const expected = shift.opening_float_minor + Number(cashReceived?.total ?? 0);
    const variance = closingCashMinor - expected;
    await this.db.run(
      `UPDATE cashier_shifts SET status = 'RECONCILED', closed_at = ?, closing_cash_minor = ?, expected_cash_minor = ? WHERE id = ?`,
      [nowIso(), closingCashMinor, expected, shiftId]
    );
    return { expected, variance };
  }
}

export { round2 };
