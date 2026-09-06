import type { ID, ISODateTime } from './common';

export type CryoEntityType = 'SPERM' | 'OOCYTE' | 'EMBRYO' | 'TISSUE';

export interface CryoFacility {
  id: ID;
  name: string;
}

export interface CryoRoom {
  id: ID;
  facilityId: ID;
  name: string;
}

export interface CryoTank {
  id: ID;
  roomId: ID;
  name: string;
  status: 'IN_SERVICE' | 'OUT_OF_SERVICE';
  /** Kelvin; null when no probe is fitted. */
  temperatureK?: number | null;
  lastTemperatureAt?: ISODateTime;
}

export interface CryoCanister {
  id: ID;
  tankId: ID;
  name: string;
}

export interface CryoPosition {
  /** Composite storage coordinate, e.g. "TANK-01/CAN-A/CANE-3/GOBLET-2/RACK-1/ROW-2/COL-1". */
  path: string;
  tankId: ID;
  canisterId?: ID | null;
  caneId?: ID | null;
  gobletId?: ID | null;
  rackId?: ID | null;
  row?: number | null;
  column?: number | null;
}

export interface CryoItem {
  id: ID;
  barcode: string;
  entityType: CryoEntityType;
  patientId: ID;
  cycleId?: string | null;
  positionId: ID;
  positionPath: string;
  status: 'STORED' | 'RELEASED' | 'DISPOSED' | 'TRANSFERRED';
  freezeAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface CryoTransferInput {
  itemId: ID;
  toPositionId: ID;
  reason?: string;
}

export interface StorageAgreement {
  id: ID;
  patientId: ID;
  itemIds: ID[];
  active: boolean;
  signedAt: ISODateTime;
  expiresAt?: ISODateTime;
}
