import type { ID, ISODateTime } from './common';

export interface MedicationCatalogItem {
  id: ID;
  code: string;
  name: string;
  controlledSubstance: boolean;
  active: boolean;
}

export interface StockItem {
  id: ID;
  medicationId: string;
  batchNumber: string;
  quantityOnHand: number;
  expiryDate?: string;
  location?: string;
  minStock: number;
}

export type StockMovementType = 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'DISPOSAL';

export interface StockMovement {
  id: ID;
  stockItemId: ID;
  type: StockMovementType;
  quantity: number;
  reference?: string;
  performedById: string;
  reason?: string;
  occurredAt: ISODateTime;
}

export interface Supplier {
  id: ID;
  name: string;
  contact?: string;
}

export interface PurchaseOrder {
  id: ID;
  supplierId: ID;
  status: 'DRAFT' | 'ISSUED' | 'RECEIVED' | 'CANCELLED';
  lines: PurchaseOrderLine[];
  createdAt: ISODateTime;
}

export interface PurchaseOrderLine {
  id?: ID;
  medicationId: string;
  quantity: number;
  unitCost: number;
}
