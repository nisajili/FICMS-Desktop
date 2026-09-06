import type { Result } from '@ficms/types';

export interface PositionOccupancy {
  positionId: string;
  occupiedByItemId: string | null;
}

/**
 * Cryostorage rule: two active (STORED) items must never share a position.
 * Returns an error result when a position is already taken by a different item.
 */
export function assertPositionAvailable(
  position: PositionOccupancy,
  incomingItemId: string
): Result<void> {
  if (position.occupiedByItemId && position.occupiedByItemId !== incomingItemId) {
    return {
      ok: false,
      error: {
        code: 'CRYO_POSITION_OCCUPIED',
        message: `Storage position is already occupied by item ${position.occupiedByItemId}.`
      }
    };
  }
  return { ok: true, value: undefined };
}

/** Build a canonical human-readable storage path from hierarchy parts. */
export function buildPositionPath(parts: {
  tank: string;
  canister?: string;
  cane?: string;
  goblet?: string;
  rack?: string;
  row?: number | null;
  column?: number | null;
}): string {
  const segments = [parts.tank];
  if (parts.canister) segments.push(parts.canister);
  if (parts.cane) segments.push(parts.cane);
  if (parts.goblet) segments.push(parts.goblet);
  if (parts.rack) segments.push(parts.rack);
  if (parts.row != null && parts.column != null) segments.push(`R${parts.row}C${parts.column}`);
  return segments.join('/');
}

export interface TankCapacity {
  capacitySlots: number;
  occupiedSlots: number;
}

export function capacityPercent(tank: TankCapacity): number {
  if (tank.capacitySlots <= 0) return 0;
  return Math.round((tank.occupiedSlots / tank.capacitySlots) * 100);
}
