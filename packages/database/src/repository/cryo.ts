import type { SqlEngine } from '../engine/types';
import { newId, nowIso, notFound, conflict, FicmsError, json } from './base';
import { assertPositionAvailable, assertDoubleWitness, buildPositionPath, capacityPercent } from '@ficms/domain';

export class CryoRepository {
  constructor(private readonly db: SqlEngine) {}

  // --- Hierarchy ----------------------------------------------------------

  async hierarchy(): Promise<{
    facilities: Record<string, unknown>[];
    rooms: Record<string, unknown>[];
    tanks: Record<string, unknown>[];
    canisters: Record<string, unknown>[];
    canes: Record<string, unknown>[];
    goblets: Record<string, unknown>[];
    racks: Record<string, unknown>[];
    positions: Record<string, unknown>[];
  }> {
    const [facilities, rooms, tanks, canisters, canes, goblets, racks, positions] = await Promise.all([
      this.db.all(`SELECT * FROM cryo_facilities`),
      this.db.all(`SELECT * FROM cryo_rooms`),
      this.db.all(`SELECT * FROM cryo_tanks`),
      this.db.all(`SELECT * FROM cryo_canisters`),
      this.db.all(`SELECT * FROM cryo_canes`),
      this.db.all(`SELECT * FROM cryo_goblets`),
      this.db.all(`SELECT * FROM cryo_racks`),
      this.db.all(`SELECT * FROM cryo_positions`)
    ]);
    return { facilities, rooms, tanks, canisters, canes, goblets, racks, positions };
  }

  async tanksWithCapacity(): Promise<Record<string, unknown>[]> {
    return this.db.all(
      `SELECT t.*, t.capacity_slots AS capacitySlots,
        (SELECT COUNT(*) FROM cryo_items i WHERE i.position_id IN (SELECT p.id FROM cryo_positions p JOIN cryo_racks r ON r.id = p.rack_id JOIN cryo_goblets g ON g.id = r.goblet_id JOIN cryo_canes c ON c.id = g.cane_id JOIN cryo_canisters cn ON cn.id = c.canister_id WHERE cn.tank_id = t.id) AND i.status = 'STORED') AS occupiedSlots
       FROM cryo_tanks t`
    );
  }

  async addPosition(data: { rackId: string; row?: number | null; column?: number | null; path: string }): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO cryo_positions (id, rack_id, row, column, path) VALUES (?, ?, ?, ?, ?)`, [id, data.rackId, data.row ?? null, data.column ?? null, data.path]);
    return id;
  }

  async createFacility(name: string): Promise<string> {
    const id = newId();
    await this.db.run(`INSERT INTO cryo_facilities (id, name) VALUES (?, ?)`, [id, name]);
    return id;
  }

  async createRoom(facilityId: string, name: string): Promise<string> {
    const facility = await this.db.get<{ id: string }>(`SELECT id FROM cryo_facilities WHERE id = ?`, [facilityId]);
    if (!facility) throw notFound('Cryo facility', facilityId);
    const id = newId();
    await this.db.run(`INSERT INTO cryo_rooms (id, facility_id, name) VALUES (?, ?, ?)`, [id, facilityId, name]);
    return id;
  }

  async createTank(data: { roomId: string; name: string; capacitySlots?: number }): Promise<string> {
    const room = await this.db.get<{ id: string }>(`SELECT id FROM cryo_rooms WHERE id = ?`, [data.roomId]);
    if (!room) throw notFound('Cryo room', data.roomId);
    const id = newId();
    await this.db.run(`INSERT INTO cryo_tanks (id, room_id, name, status, capacity_slots) VALUES (?, ?, ?, 'IN_SERVICE', ?)`, [id, data.roomId, data.name, data.capacitySlots ?? 100]);
    return id;
  }

  async createCanister(tankId: string, name: string): Promise<string> {
    const tank = await this.db.get<{ id: string }>(`SELECT id FROM cryo_tanks WHERE id = ?`, [tankId]);
    if (!tank) throw notFound('Cryo tank', tankId);
    const id = newId();
    await this.db.run(`INSERT INTO cryo_canisters (id, tank_id, name) VALUES (?, ?, ?)`, [id, tankId, name]);
    return id;
  }

  async createCane(canisterId: string, name: string): Promise<string> {
    const canister = await this.db.get<{ id: string }>(`SELECT id FROM cryo_canisters WHERE id = ?`, [canisterId]);
    if (!canister) throw notFound('Cryo canister', canisterId);
    const id = newId();
    await this.db.run(`INSERT INTO cryo_canes (id, canister_id, name) VALUES (?, ?, ?)`, [id, canisterId, name]);
    return id;
  }

  async createGoblet(caneId: string, name: string): Promise<string> {
    const cane = await this.db.get<{ id: string }>(`SELECT id FROM cryo_canes WHERE id = ?`, [caneId]);
    if (!cane) throw notFound('Cryo cane', caneId);
    const id = newId();
    await this.db.run(`INSERT INTO cryo_goblets (id, cane_id, name) VALUES (?, ?, ?)`, [id, caneId, name]);
    return id;
  }

  async createRack(gobletId: string, name: string): Promise<string> {
    const goblet = await this.db.get<{ id: string }>(`SELECT id FROM cryo_goblets WHERE id = ?`, [gobletId]);
    if (!goblet) throw notFound('Cryo goblet', gobletId);
    const id = newId();
    await this.db.run(`INSERT INTO cryo_racks (id, goblet_id, name) VALUES (?, ?, ?)`, [id, gobletId, name]);
    return id;
  }

  /**
   * Create a storage position under a rack, deriving its canonical path from
   * the tank→canister→cane→goblet→rack ancestor names.
   */
  async createPosition(rackId: string, row?: number | null, column?: number | null): Promise<string> {
    const chain = await this.db.get<{
      tankName: string;
      canisterName: string;
      caneName: string;
      gobletName: string;
      rackName: string;
    }>(
      `SELECT t.name AS tankName, cn.name AS canisterName, c.name AS caneName, g.name AS gobletName, r.name AS rackName
       FROM cryo_racks r
       JOIN cryo_goblets g ON g.id = r.goblet_id
       JOIN cryo_canes c ON c.id = g.cane_id
       JOIN cryo_canisters cn ON cn.id = c.canister_id
       JOIN cryo_tanks t ON t.id = cn.tank_id
       WHERE r.id = ?`,
      [rackId]
    );
    if (!chain) throw notFound('Cryo rack', rackId);
    const path = buildPositionPath({ tank: chain.tankName, canister: chain.canisterName, cane: chain.caneName, goblet: chain.gobletName, rack: chain.rackName, row, column });
    return this.addPosition({ rackId, row, column, path });
  }

  async logTemperature(tankId: string, temperatureK: number): Promise<void> {
    await this.db.run(`INSERT INTO temperature_logs (id, tank_id, temperature_k, recorded_at) VALUES (?, ?, ?, ?)`, [newId(), tankId, temperatureK, nowIso()]);
  }

  // --- Items --------------------------------------------------------------

  async items(opts: { patientId?: string; status?: string; entityType?: string } = {}): Promise<Record<string, unknown>[]> {
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
    if (opts.entityType) {
      clauses.push('i.entity_type = ?');
      params.push(opts.entityType);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db.all(
      `SELECT i.*, p.path AS positionPath, pat.mrn AS patientMrn, e.code AS embryoCode
       FROM cryo_items i
       JOIN cryo_positions p ON p.id = i.position_id
       LEFT JOIN patients pat ON pat.id = i.patient_id
       LEFT JOIN embryo_records e ON e.id = i.embryo_id
       ${where} ORDER BY i.created_at DESC`,
      params
    );
  }

  async findItem(id: string): Promise<Record<string, unknown> | undefined> {
    return this.db.get(
      `SELECT i.*, p.path AS positionPath FROM cryo_items i JOIN cryo_positions p ON p.id = i.position_id WHERE i.id = ?`,
      [id]
    );
  }

  /**
   * Store an item. Enforced inside a transaction:
   *  1. the target position must exist and be unoccupied by another active item;
   *  2. an identity-sensitive event requires double-witness verification.
   */
  async store(data: {
    barcode: string;
    entityType: string;
    patientId: string;
    positionId: string;
    freezeAt: string;
    cycleId?: string | null;
    embryoId?: string | null;
    primaryUserId: string;
    witnessUserId?: string | null;
  }): Promise<string> {
    return this.db.transaction(async (tx) => {
      const position = await tx.get<{ id: string }>(`SELECT id FROM cryo_positions WHERE id = ?`, [data.positionId]);
      if (!position) throw notFound('Storage position', data.positionId);

      const occupied = await tx.get<{ id: string }>(
        `SELECT id FROM cryo_items WHERE position_id = ? AND status = 'STORED' LIMIT 1`,
        [data.positionId]
      );
      const avail = assertPositionAvailable({ positionId: data.positionId, occupiedByItemId: occupied?.id ?? null }, '__new__');
      if (!avail.ok) throw conflict(avail.error.code, avail.error.message);

      const witness = assertDoubleWitness({
        primaryUserId: data.primaryUserId,
        witnessUserId: data.witnessUserId ?? '',
        status: data.witnessUserId ? 'VERIFIED' : 'PENDING'
      });
      if (!witness.ok) throw new FicmsError(witness.error.code, witness.error.message, 422);

      const id = newId();
      await tx.run(
        `INSERT INTO cryo_items (id, barcode, entity_type, patient_id, cycle_id, embryo_id, position_id, status, freeze_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'STORED', ?, ?)`,
        [id, data.barcode, data.entityType, data.patientId, data.cycleId ?? null, data.embryoId ?? null, data.positionId, data.freezeAt, nowIso()]
      );
      await tx.run(
        `INSERT INTO witness_verifications (id, event_type, entity_type, entity_id, primary_user_id, witness_user_id, status, verified_at, created_at)
         VALUES (?, 'CRYO_STORE', 'CRYO_ITEM', ?, ?, ?, 'VERIFIED', ?, ?)`,
        [newId(), id, data.primaryUserId, data.witnessUserId, nowIso(), nowIso()]
      );
      return id;
    });
  }

  async transfer(data: { itemId: string; toPositionId: string; reason?: string | null; performedById: string; witnessUserId?: string | null }): Promise<void> {
    const witness = assertDoubleWitness({ primaryUserId: data.performedById, witnessUserId: data.witnessUserId ?? '', status: data.witnessUserId ? 'VERIFIED' : 'PENDING' });
    if (!witness.ok) throw new FicmsError(witness.error.code, witness.error.message, 422);

    await this.db.transaction(async (tx) => {
      const item = await tx.get<{ id: string; position_id: string; status: string }>(`SELECT id, position_id, status FROM cryo_items WHERE id = ?`, [data.itemId]);
      if (!item) throw notFound('Cryo item', data.itemId);
      if (item.status !== 'STORED') throw conflict('CRYO_NOT_STORED', 'Only stored items can be transferred.');

      const target = await tx.get<{ id: string }>(`SELECT id FROM cryo_positions WHERE id = ?`, [data.toPositionId]);
      if (!target) throw notFound('Storage position', data.toPositionId);

      const occupied = await tx.get<{ id: string }>(
        `SELECT id FROM cryo_items WHERE position_id = ? AND status = 'STORED' AND id != ? LIMIT 1`,
        [data.toPositionId, data.itemId]
      );
      const avail = assertPositionAvailable({ positionId: data.toPositionId, occupiedByItemId: occupied?.id ?? null }, data.itemId);
      if (!avail.ok) throw conflict(avail.error.code, avail.error.message);

      await tx.run(`INSERT INTO cryo_transfers (id, item_id, from_position_id, to_position_id, reason, performed_by_id, performed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        newId(), data.itemId, item.position_id, data.toPositionId, data.reason ?? null, data.performedById, nowIso()
      ]);
      await tx.run(`UPDATE cryo_items SET position_id = ? WHERE id = ?`, [data.toPositionId, data.itemId]);
      await tx.run(
        `INSERT INTO witness_verifications (id, event_type, entity_type, entity_id, primary_user_id, witness_user_id, status, verified_at, created_at)
         VALUES (?, 'CRYO_TRANSFER', 'CRYO_ITEM', ?, ?, ?, 'VERIFIED', ?, ?)`,
        [newId(), data.itemId, data.performedById, data.witnessUserId, nowIso(), nowIso()]
      );
    });
  }

  async releaseOrDispose(itemId: string, action: 'RELEASED' | 'DISPOSED', performedById: string, witnessUserId?: string | null, reason?: string | null): Promise<void> {
    const witness = assertDoubleWitness({ primaryUserId: performedById, witnessUserId: witnessUserId ?? '', status: witnessUserId ? 'VERIFIED' : 'PENDING' });
    if (!witness.ok) throw new FicmsError(witness.error.code, witness.error.message, 422);

    await this.db.transaction(async (tx) => {
      const item = await tx.get<{ id: string; status: string }>(`SELECT id, status FROM cryo_items WHERE id = ?`, [itemId]);
      if (!item) throw notFound('Cryo item', itemId);
      if (item.status !== 'STORED') throw conflict('CRYO_NOT_STORED', 'Only stored items can be released or disposed.');

      const column = action === 'RELEASED' ? 'released_at' : 'disposed_at';
      await tx.run(`UPDATE cryo_items SET status = ?, ${column} = ? WHERE id = ?`, [action, nowIso(), itemId]);
      await tx.run(
        `INSERT INTO witness_verifications (id, event_type, entity_type, entity_id, primary_user_id, witness_user_id, status, notes, verified_at, created_at)
         VALUES (?, ?, 'CRYO_ITEM', ?, ?, ?, 'VERIFIED', ?, ?, ?)`,
        [newId(), action === 'RELEASED' ? 'CRYO_RELEASE' : 'CRYO_DISPOSAL', itemId, performedById, witnessUserId, reason ?? null, nowIso(), nowIso()]
      );
    });
  }

  async storageAgreement(data: { patientId: string; itemIds: string[]; signedAt: string; expiresAt?: string | null }): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO storage_agreements (id, patient_id, item_ids, active, signed_at, expires_at, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [id, data.patientId, json(data.itemIds), data.signedAt, data.expiresAt ?? null, nowIso()]
    );
    return id;
  }

  async witnessVerifications(entityId: string): Promise<Record<string, unknown>[]> {
    return this.db.all(`SELECT * FROM witness_verifications WHERE entity_id = ? ORDER BY created_at DESC`, [entityId]);
  }
}

export { capacityPercent, buildPositionPath };
