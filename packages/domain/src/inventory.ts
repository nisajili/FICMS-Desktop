import type { Result } from '@ficms/types';

export interface StockLevel {
  quantityOnHand: number;
}

/** Stock must never go negative as a result of an issue/adjustment. */
export function assertSufficientStock(level: StockLevel, requested: number): Result<void> {
  if (requested <= 0) {
    return { ok: false, error: { code: 'INVALID_QUANTITY', message: 'Quantity must be positive.' } };
  }
  if (level.quantityOnHand < requested) {
    return { ok: false, error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient stock: ${level.quantityOnHand} on hand.` } };
  }
  return { ok: true, value: undefined };
}

/**
 * FEFO (First-Expired, First-Out): order batches by expiry date ascending,
 * then by batch number for determinism.
 */
export function fefoOrder(batches: { id: string; expiryDate?: string | null; batchNumber: string }[]): string[] {
  return [...batches]
    .sort((a, b) => {
      const ea = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      const eb = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      if (ea !== eb) return ea - eb;
      return a.batchNumber.localeCompare(b.batchNumber);
    })
    .map((b) => b.id);
}
