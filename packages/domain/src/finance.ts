import type { Result } from '@ficms/types';

export interface InvoiceTotalsInput {
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  taxRate: number; // e.g. 0.18 for 18%
}

export interface LineTotals {
  gross: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

/** Compute a single invoice line total (gross -> discount -> tax). */
export function lineTotals(input: InvoiceTotalsInput): LineTotals {
  const gross = round2(input.unitPrice * input.quantity);
  const discountAmount = round2(Math.min(input.discountAmount, gross));
  const taxable = gross - discountAmount;
  const taxAmount = round2(taxable * input.taxRate);
  const lineTotal = round2(taxable + taxAmount);
  return { gross, discountAmount, taxAmount, lineTotal };
}

/**
 * Validate a payment against an invoice's outstanding balance. Payments may
 * be partial but may not overpay beyond a small rounding tolerance.
 */
export function assertPaymentAmount(outstanding: number, amount: number): Result<void> {
  if (amount <= 0) {
    return { ok: false, error: { code: 'INVALID_AMOUNT', message: 'Payment amount must be positive.' } };
  }
  if (amount > outstanding + 0.009) {
    return {
      ok: false,
      error: { code: 'OVERPAYMENT', message: `Payment exceeds the outstanding balance of ${round2(outstanding)}.` }
    };
  }
  return { ok: true, value: undefined };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
