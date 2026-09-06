import { Injectable } from '@nestjs/common';
import { newIdempotencyKey } from '@ficms/domain';
import { DatabaseService } from '../../common/database.service';

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  async listStock() {
    return this.db.repos.inventory.listStock();
  }

  async createStockItem(input: { medicationId: string; batchNumber: string; quantityOnHand: number; expiryDate?: string | null; location?: string | null; minStock?: number }) {
    return { id: await this.db.repos.inventory.createStockItem(input) };
  }

  async movement(input: { stockItemId: string; type: string; quantity: number; reference?: string | null; reason?: string | null }, userId: string) {
    const id = await this.db.repos.inventory.movement({
      stockItemId: input.stockItemId,
      type: input.type as never,
      quantity: input.quantity,
      reference: input.reference,
      reason: input.reason,
      performedById: userId,
      idempotencyKey: newIdempotencyKey()
    });
    return { id };
  }

  async adjust(input: { stockItemId: string; delta: number; reason?: string | null }, userId: string) {
    return { id: await this.db.repos.inventory.adjust({ ...input, performedById: userId }) };
  }

  async issueFefo(medicationId: string, quantity: number, userId: string) {
    const ids = await this.db.repos.inventory.issueFefo(medicationId, quantity, userId);
    return { movementIds: ids };
  }

  async ledger() {
    return this.db.repos.inventory.ledger();
  }

  async expiring(days?: number) {
    return this.db.repos.inventory.expiringSoon(days);
  }

  async lowStock() {
    return this.db.repos.inventory.lowStock();
  }

  async dispense(input: { prescriptionId: string; stockItemId: string; quantity: number; partial?: boolean; verifiedById?: string | null }, userId: string) {
    return { id: await this.db.repos.inventory.dispense({ ...input, dispensedById: userId }) };
  }

  async suppliers() {
    return this.db.repos.inventory.listSuppliers();
  }

  async createSupplier(name: string, contact?: string | null) {
    return { id: await this.db.repos.inventory.createSupplier(name, contact) };
  }

  async createPurchaseOrder(input: { supplierId: string; lines: { medicationId: string; quantity: number; unitCostMinor: number }[] }) {
    return { id: await this.db.repos.inventory.createPurchaseOrder(input) };
  }
}
