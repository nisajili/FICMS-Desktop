import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Patient, type Row } from '../api';
import { useAuth } from '../auth';
import { cell, fmtDate } from '../kit';

export function CryobankPage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [hierarchy, setHierarchy] = useState<Row | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // hierarchy creation
  const [facilityName, setFacilityName] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tankName, setTankName] = useState('');
  const [tankId, setTankId] = useState('');
  const [rackId, setRackId] = useState('');

  // item storage
  const [barcode, setBarcode] = useState('');
  const [entityType, setEntityType] = useState('EMBRYO');
  const [patientId, setPatientId] = useState('');
  const [positionId, setPositionId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [h, i] = await Promise.all([api.cryoHierarchy(token), api.cryoItems(token)]);
      setHierarchy(h);
      setItems(i);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load cryobank.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    void api.patients(token, 1, 100).then((p) => setPatients(p.items)).catch(() => undefined);
  }, [token]);

  const run = async (fn: () => Promise<unknown>) => {
    setFormError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Operation failed.');
    }
  };

  const createFacility = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const f = await api.cryoPost(token!, 'facilities', { name: facilityName });
      setFacilityId(cell(f, 'id'));
      setFacilityName('');
    });
  };

  const createRoom = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await api.cryoPost(token!, 'rooms', { facilityId, name: roomName });
      setRoomId(cell(r, 'id'));
      setRoomName('');
    });
  };

  const createTank = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const t = await api.cryoPost(token!, 'tanks', { roomId, name: tankName, capacitySlots: 120 });
      setTankId(cell(t, 'id'));
      setTankName('');
    });
  };

  const createRack = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const canister = await api.cryoPost(token!, 'canisters', { tankId, name: 'Canister 1' });
      const cane = await api.cryoPost(token!, 'canes', { canisterId: cell(canister, 'id'), name: 'Cane 1' });
      const goblet = await api.cryoPost(token!, 'goblets', { caneId: cell(cane, 'id'), name: 'Goblet 1' });
      const rack = await api.cryoPost(token!, 'racks', { gobletId: cell(goblet, 'id'), name: 'Rack 1' });
      setRackId(cell(rack, 'id'));
    });
  };

  const createPosition = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const pos = await api.cryoPost(token!, 'positions', { rackId, row: 1, column: 1 });
      setPositionId(cell(pos, 'id'));
    });
  };

  const storeItem = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.cryoStore(token!, { barcode, entityType, patientId, positionId, freezeAt: new Date().toISOString() });
      setBarcode('');
    });
  };

  const tanks = (hierarchy?.tanks ?? []) as Row[];
  const positions = (hierarchy?.positions ?? []) as Row[];

  return (
    <div className="page">
      <header className="page-head">
        <h1>Cryobank</h1>
        <p className="muted">facility → room → tank → canister → cane → goblet → rack → position.</p>
      </header>
      {error && <div className="error">{error}</div>}
      {formError && <div className="error">{formError}</div>}

      <section className="panel">
        <h2>Build hierarchy</h2>
        <div className="stack">
          <form onSubmit={createFacility} className="row">
            <label>
              Facility name
              <input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} required />
            </label>
            <button className="btn" type="submit">
              Add facility
            </button>
          </form>
          <form onSubmit={createRoom} className="row">
            <label>
              Facility
              <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} required>
                <option value="">Select…</option>
                {(hierarchy?.facilities as Row[] | undefined)?.map((f) => (
                  <option key={cell(f, 'id')} value={cell(f, 'id')}>
                    {cell(f, 'name')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Room name
              <input value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
            </label>
            <button className="btn" type="submit">
              Add room
            </button>
          </form>
          <form onSubmit={createTank} className="row">
            <label>
              Room
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
                <option value="">Select…</option>
                {(hierarchy?.rooms as Row[] | undefined)?.map((r) => (
                  <option key={cell(r, 'id')} value={cell(r, 'id')}>
                    {cell(r, 'name')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tank name
              <input value={tankName} onChange={(e) => setTankName(e.target.value)} required />
            </label>
            <button className="btn" type="submit">
              Add tank
            </button>
          </form>
          <div className="row">
            <label>
              Tank
              <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
                <option value="">Select…</option>
                {tanks.map((t) => (
                  <option key={cell(t, 'id')} value={cell(t, 'id')}>
                    {cell(t, 'name')}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" onClick={() => void run(createRack as unknown as () => Promise<unknown>)}>
              Add full rack (canister→cane→goblet→rack)
            </button>
          </div>
          <div className="row">
            <label>
              Rack ID (after adding a full rack)
              <input value={rackId} onChange={(e) => setRackId(e.target.value)} />
            </label>
            <button className="btn" onClick={() => void run(createPosition as unknown as () => Promise<unknown>)}>
              Add position R1C1
            </button>
          </div>
        </div>
      </section>

      <div className="grid">
        <section className="panel">
          <h2>Store item</h2>
          <form onSubmit={storeItem} className="stack">
            <div className="row">
              <label>
                Barcode
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} required />
              </label>
              <label>
                Entity type
                <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                  {['EMBRYO', 'SPERM', 'OOCYTE', 'TISSUE'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Patient
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
                <option value="">Select…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.mrn} — {p.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Position
              <select value={positionId} onChange={(e) => setPositionId(e.target.value)} required>
                <option value="">Select…</option>
                {positions.map((p) => (
                  <option key={cell(p, 'id')} value={cell(p, 'id')}>
                    {cell(p, 'path')}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">
              Store
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Stored items</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Type</th>
                <th>Position</th>
                <th>Status</th>
                <th>Frozen</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={cell(i, 'id')}>
                  <td className="mono">{cell(i, 'barcode')}</td>
                  <td>{cell(i, 'entityType', 'entity_type')}</td>
                  <td className="mono">{cell(i, 'positionPath', 'position_path')}</td>
                  <td>{cell(i, 'status')}</td>
                  <td>{fmtDate(i.freezeAt ?? i.freeze_at)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No stored items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
