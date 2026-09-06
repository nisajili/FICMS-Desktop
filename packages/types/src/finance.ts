import type { ID, ISODate, ISODateTime } from './common';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'CREDITED';

export interface InvoiceLine {
  id?: ID;
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Invoice {
  id: ID;
  number: string;
  patientId: ID;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  dueTotal: number;
  issuedAt?: ISODateTime;
  dueDate?: ISODate;
  createdAt: ISODateTime;
}

export type PaymentMethod = 'CASH' | 'BANK' | 'CARD' | 'MOBILE_MONEY' | 'INSURANCE' | 'OTHER';

export interface Payment {
  id: ID;
  invoiceId: ID;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  /** Idempotency key supplied by the client; a payment with a duplicate key is not re-applied. */
  idempotencyKey: string;
  receivedAt: ISODateTime;
  recordedById: string;
  voided: boolean;
}

export interface CreditNote {
  id: ID;
  invoiceId: ID;
  number: string;
  amount: number;
  reason: string;
  createdAt: ISODateTime;
}

export interface ServiceCatalogItem {
  id: ID;
  code: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  active: boolean;
}

export interface CashierShift {
  id: ID;
  userId: ID;
  openedAt: ISODateTime;
  closedAt?: ISODateTime;
  openingFloat: number;
  closingCash?: number | null;
  expectedCash?: number | null;
  variance?: number | null;
  status: 'OPEN' | 'CLOSED' | 'RECONCILED';
}
