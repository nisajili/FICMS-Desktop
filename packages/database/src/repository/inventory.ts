import type { SqlEngine } from '../engine/types';
import { newId, nowIso, notFound, FicmsError } from './base';
import { assertSufficientStock, fefoOrder } from '@ficms/domain';

export class InventoryRepository {
  constructor(private readonly db: SqlEngine) {}

  async listStock(): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT s.*, m.name AS medicationName, m.code AS medicationCode, m.controlled_substance AS controlledSubstance
       FROM stock_items s JOIN medication_catalog m ON m.id = s.medication_id ORDER BY m.name, s.expiry_date`
    );
  }

  async findStockItem(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(`SELECT * FROM stock_items WHERE id = ?`, [id]);
  }

  async createStockItem(data: { medicationId: string; batchNumber: string; quantityOnHand: number; expiryDate?: string | null; location?: string | null; minStock?: number }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO stock_items (id, medication_id, batch_number, quantity_on_hand, expiry_date, location, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.medicationId, data.batchNumber, data.quantityOnHand, data.expiryDate ?? null, data.location ?? null, data.minStock ?? 0]
    );
    return id;
  }

  /**
   * Apply a stock movement transactionally. ISSUE/TRANSFER_OUT/DISPOSAL
   * decrement; RECEIPT/RETURN/TRANSFER_IN/ADJUSTMENT increment. Stock is never
   * allowed to go negative and a duplicate idempotency key is ignored.
   */
  async movement(data: {
    stockItemId: string;
    type: 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'DISPOSAL';
    quantity: number;
    performedById: string;
    reference?: string | null;
    reason?: string | null;
    idempotencyKey?: string | null;
  }): Promise<string> {
    if (data.idempotencyKey) {
      const existing = await this.db.get<{ id: string }>(`SELECT id FROM stock_movements WHERE idempotency_key = ?`, [data.idempotencyKey]);
      if (existing) return existing.id;
    }

    const delta = this.deltaFor(data.type) * data.quantity;
    return this.db.transaction(async (tx) => {
      const item = await tx.get<{ id: string; quantity_on_hand: number }>(`SELECT id, quantity_on_hand FROM stock_items WHERE id = ?`, [data.stockItemId]);
      if (!item) throw notFound('Stock item', data.stockItemId);

      if (delta < 0) {
        const check = assertSufficientStock({ quantityOnHand: item.quantity_on_hand }, Math.abs(delta));
        if (!check.ok) throw new FicmsError(check.error.code, check.error.message, 422);
      }

      await tx.run(`UPDATE stock_items SET quantity_on_hand = quantity_on_hand + ? WHERE id = ?`, [delta, data.stockItemId]);
      const id = newId();
      await tx.run(
        `INSERT INTO stock_movements (id, stock_item_id, type, quantity, reference, reason, performed_by_id, idempotency_key, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.stockItemId, data.type, data.quantity, data.reference ?? null, data.reason ?? null, data.performedById, data.idempotencyKey ?? null, nowIso()]
      );
      return id;
    });
  }

  private deltaFor(type: string): number {
    switch (type) {
      case 'ISSUE':
      case 'TRANSFER_OUT':
      case 'DISPOSAL':
        return -1;
      case 'ADJUSTMENT':
        return 0; // adjustments carry a signed quantity
      default:
        return 1;
    }
  }

  /** Adjust stock by a signed quantity (positive or negative). */
  async adjust(data: { stockItemId: string; delta: number; performedById: string; reason?: string | null }): Promise<string> {
    return this.db.transaction(async (tx) => {
      const item = await tx.get<{ id: string; quantity_on_hand: number }>(`SELECT id, quantity_on_hand FROM stock_items WHERE id = ?`, [data.stockItemId]);
      if (!item) throw notFound('Stock item', data.stockItemId);
      const next = item.quantity_on_hand + data.delta;
      if (next < 0) throw new FicmsError('INSUFFICIENT_STOCK', 'Adjustment would make stock negative.', 422);
      await tx.run(`UPDATE stock_items SET quantity_on_hand = ? WHERE id = ?`, [next, data.stockItemId]);
      const id = newId();
      await tx.run(
        `INSERT INTO stock_movements (id, stock_item_id, type, quantity, reason, performed_by_id, occurred_at) VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, ?)`,
        [id, data.stockItemId, Math.abs(data.delta), data.reason ?? null, data.performedById, nowIso()]
      );
      return id;
    });
  }

  /** FEFO issue across batches of a medication. */
  async issueFefo(medicationId: string, quantity: number, performedById: string, reference?: string | null): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const batches = await tx.all<{ id: string; expiry_date: string | null; batch_number: string; quantity_on_hand: number }>(
        `SELECT id, expiry_date, batch_number, quantity_on_hand FROM stock_items WHERE medication_id = ? AND quantity_on_hand > 0`,
        [medicationId]
      );
      const totalOnHand = batches.reduce((sum, b) => sum + b.quantity_on_hand, 0);
      if (totalOnHand < quantity) throw new FicmsError('INSUFFICIENT_STOCK', `Insufficient stock: ${totalOnHand} on hand.`, 422);

      const order = fefoOrder(batches.map((b) => ({ id: b.id, expiryDate: b.expiry_date, batchNumber: b.batch_number })));
      const byId = new Map(batches.map((b) => [b.id, b]));
      let remaining = quantity;
      const movementIds: string[] = [];
      for (const id of order) {
        if (remaining <= 0) break;
        const batch = byId.get(id)!;
        const take = Math.min(batch.quantity_on_hand, remaining);
        await tx.run(`UPDATE stock_items SET quantity_on_hand = quantity_on_hand - ? WHERE id = ?`, [take, id]);
        const movementId = newId();
        await tx.run(
          `INSERT INTO stock_movements (id, stock_item_id, type, quantity, reference, performed_by_id, occurred_at) VALUES (?, ?, 'ISSUE', ?, ?, ?, ?)`,
          [movementId, id, take, reference ?? null, performedById, nowIso()]
        );
        movementIds.push(movementId);
        remaining -= take;
      }
      return movementIds;
    });
  }

  async movements(stockItemId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM stock_movements WHERE stock_item_id = ? ORDER BY occurred_at DESC`, [stockItemId]);
  }

  async ledger(): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT m.*, s.batch_number AS batchNumber, mc.name AS medicationName
       FROM stock_movements m
       JOIN stock_items s ON s.id = m.stock_item_id
       JOIN medication_catalog mc ON mc.id = s.medication_id
       ORDER BY m.occurred_at DESC LIMIT 1000`
    );
  }

  async expiringSoon(days = 90): Promise<Record<string, unknown>[]> {
    const threshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    return this.db.all(
      `SELECT s.*, m.name AS medicationName FROM stock_items s JOIN medication_catalog m ON m.id = s.medication_id
       WHERE s.expiry_date IS NOT NULL AND s.expiry_date <= ? AND s.quantity_on_hand > 0 ORDER BY s.expiry_date`,
      [threshold]
    );
  }

  async lowStock(): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT s.*, m.name AS medicationName FROM stock_items s JOIN medication_catalog m ON m.id = s.medication_id
       WHERE s.quantity_on_hand <= s.min_stock ORDER BY s.quantity_on_hand`
    );
  }

  // --- Dispensing ----------------------------------------------------------

  async dispense(data: { prescriptionId: string; stockItemId: string; quantity: number; partial?: boolean; dispensedById: string; verifiedById?: string | null }): Promise<string> {
    return this.db.transaction(async (tx) => {
      const item = await tx.get<{ id: string; quantity_on_hand: number }>(`SELECT id, quantity_on_hand FROM stock_items WHERE id = ?`, [data.stockItemId]);
      if (!item) throw notFound('Stock item', data.stockItemId);
      const check = assertSufficientStock({ quantityOnHand: item.quantity_on_hand }, data.quantity);
      if (!check.ok) throw new FicmsError(check.error.code, check.error.message, 422);

      await tx.run(`UPDATE stock_items SET quantity_on_hand = quantity_on_hand - ? WHERE id = ?`, [data.quantity, data.stockItemId]);
      const id = newId();
      await tx.run(
        `INSERT INTO dispensings (id, prescription_id, stock_item_id, quantity, partial, dispensed_by_id, verified_by_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.prescriptionId, data.stockItemId, data.quantity, data.partial ? 1 : 0, data.dispensedById, data.verifiedById ?? null, nowIso()]
      );
      await tx.run(
        `INSERT INTO stock_movements (id, stock_item_id, type, quantity, reference, performed_by_id, occurred_at) VALUES (?, ?, 'ISSUE', ?, ?, ?, ?)`,
        [newId(), data.stockItemId, data.quantity, `DISPENSE-${data.prescriptionId}`, data.dispensedById, nowIso()]
      );
      // Full dispensing marks the prescription dispensed.
      if (!data.partial) {
        await tx.run(`UPDATE prescriptions SET status = 'DISPENSED' WHERE id = ?`, [data.prescriptionId]);
      }
      return id;
    });
  }

  // --- Suppliers / purchase orders ----------------------------------------

  async createSupplier(name: string, contact?: string | null): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO suppliers (id, name, contact) VALUES (?, ?, ?)`, [id, name, contact ?? null]);
    return id;
  }

  async listSuppliers(): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM suppliers ORDER BY name`);
  }

  async createPurchaseOrder(data: { supplierId: string; lines: { medicationId: string; quantity: number; unitCostMinor: number }[] }): Promise<string> {
    const id = newId();
    await this.db.transaction(async (tx) => {
      await tx.run(`INSERT INTO purchase_orders (id, supplier_id, status, created_at) VALUES (?, ?, 'DRAFT', ?)`, [id, data.supplierId, nowIso()]);
      for (const line of data.lines) {
        await tx.run(
          `INSERT INTO purchase_order_lines (id, order_id, medication_id, quantity, unit_cost_minor) VALUES (?, ?, ?, ?, ?)`,
          [newId(), id, line.medicationId, line.quantity, line.unitCostMinor]
        );
      }
    });
    return id;
  }
}
