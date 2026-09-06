/**
 * End-to-end smoke tests for the versioned REST API.
 *
 * NestJS relies on decorator metadata emitted by `tsc`, which Vitest's esbuild
 * transform does not preserve. So instead of importing the Nest app in-process,
 * we spawn the compiled server (`node dist/main.js`) on an ephemeral loopback
 * port with a throwaway SQLite database and exercise it over real HTTP.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

async function freePort(): Promise<number> {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as net.AddressInfo;
  server.close();
  await once(server, 'close');
  return port;
}

function waitFor(proc: ChildProcess, pattern: RegExp, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern}. Log:\n${buf}`)), timeoutMs);
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      if (pattern.test(buf)) {
        clearTimeout(timer);
        resolve();
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early (code ${code}). Log:\n${buf}`));
    });
  });
}

describe('FICMS API (e2e smoke)', () => {
  let proc: ChildProcess;
  let base: string;
  let tmpDir: string;
  let accessToken: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ficms-e2e-'));
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;

    proc = spawn(process.execPath, ['dist/main.js'], {
      cwd: path.resolve(__dirname, '..', '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FICMS_HOST: '127.0.0.1',
        FICMS_PORT: String(port),
        FICMS_APP_SECRET: 'e2e-secret',
        FICMS_SEED: 'true',
        FICMS_SEED_ADMIN_PASSWORD: 'E2ePassw0rd!',
        DATABASE_URL: `file:${path.join(tmpDir, 'e2e.db')}`
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitFor(proc, /FICMS.*listening/i);
  });

  afterAll(() => {
    proc?.kill('SIGTERM');
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('serves health', async () => {
    const res = await fetch(`${base}/api/v1/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; provider: string };
    expect(body.status).toBe('ok');
    expect(body.provider).toBe('sqlite');
  });

  it('serves public branding without authentication', async () => {
    const res = await fetch(`${base}/api/v1/settings/branding`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { currency: string; country: string };
    expect(body.currency).toBe('TZS');
    expect(body.country).toBe('TZ');
  });

  it('rejects unauthenticated access to protected routes', async () => {
    const res = await fetch(`${base}/api/v1/patients`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { statusCode: number; code: string };
    expect(body.statusCode).toBe(401);
    expect(body.code).toBe('HTTP_ERROR');
  });

  it('logs in with the seeded admin and reads /me', async () => {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'E2ePassw0rd!' })
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { accessToken: string; user: { roles: string[] } };
    expect(body.accessToken).toBeTruthy();
    expect(body.user.roles).toContain('SYSTEM_ADMINISTRATOR');
    accessToken = body.accessToken;

    const me = await fetch(`${base}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(me.status).toBe(200);
  });

  it('creates and lists patients with sequential MRNs', async () => {
    const create = await fetch(`${base}/api/v1/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ firstName: 'E2E', lastName: 'Patient', sex: 'FEMALE', dateOfBirth: '1990-01-01' })
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { mrn: string; fullName: string };
    expect(created.mrn).toBe('MRN-00002');
    expect(created.fullName).toBe('E2E Patient');

    const list = await fetch(`${base}/api/v1/patients`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(list.status).toBe(200);
    const page = (await list.json()) as { total: number; items: { mrn: string }[] };
    expect(page.total).toBe(2);
    expect(page.items.map((p) => p.mrn).sort()).toEqual(['MRN-00001', 'MRN-00002']);
  });

  it('builds the cryobank hierarchy and derives a storage position path', async () => {
    const post = async (url: string, body: Record<string, unknown>) => {
      const res = await fetch(`${base}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body)
      });
      expect(res.status).toBe(201);
      return (await res.json()) as { id: string };
    };

    const facility = await post('/api/v1/cryobank/facilities', { name: 'Cryo Lab A' });
    const room = await post('/api/v1/cryobank/rooms', { facilityId: facility.id, name: 'Room 1' });
    const tank = await post('/api/v1/cryobank/tanks', { roomId: room.id, name: 'Tank 1', capacitySlots: 120 });
    const canister = await post('/api/v1/cryobank/canisters', { tankId: tank.id, name: 'Canister 1' });
    const cane = await post('/api/v1/cryobank/canes', { canisterId: canister.id, name: 'Cane 1' });
    const goblet = await post('/api/v1/cryobank/goblets', { caneId: cane.id, name: 'Goblet 1' });
    const rack = await post('/api/v1/cryobank/racks', { gobletId: goblet.id, name: 'Rack 1' });
    const position = await post('/api/v1/cryobank/positions', { rackId: rack.id, row: 1, column: 2 });

    const res = await fetch(`${base}/api/v1/cryobank/hierarchy`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(res.status).toBe(200);
    const hierarchy = (await res.json()) as { positions: { id: string; path: string }[] };
    const pos = hierarchy.positions.find((p) => p.id === position.id);
    expect(pos).toBeDefined();
    expect(pos?.path).toBe('Tank 1/Canister 1/Cane 1/Goblet 1/Rack 1/R1C2');
  });

  it('runs a full ART cycle: monitoring, oocytes, fertilization, embryo, PGT', async () => {
    const authed = (url: string, body?: Record<string, unknown>, method = 'POST') =>
      fetch(`${base}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

    const patientRes = await authed('/api/v1/patients', { firstName: 'E2E', lastName: 'Cycle', sex: 'FEMALE', dateOfBirth: '1988-05-05' });
    expect(patientRes.status).toBe(201);
    const patient = (await patientRes.json()) as { id: string; mrn: string };
    expect(patient.mrn).toBe('MRN-00003');

    const cycleRes = await authed('/api/v1/cycles', { patientId: patient.id, type: 'IVF', startDate: '2026-01-01' });
    expect(cycleRes.status).toBe(201);
    const cycle = (await cycleRes.json()) as { id: string; cycleNumber: string; status: string; type: string };
    expect(cycle.cycleNumber).toMatch(/^CYC-\d{5}$/);
    expect(cycle.status).toBe('PLANNED');
    expect(cycle.type).toBe('IVF');

    const step = async (path: string, body: Record<string, unknown>) => {
      const r = await authed(path, body);
      expect(r.status).toBe(201);
      return (await r.json()) as { id: string };
    };

    await step(`/api/v1/cycles/${cycle.id}/follicles`, { date: '2026-01-05', ovary: 'LEFT', count: 6, sizesMm: [12, 13, 11, 15, 12, 14], endometriumMm: 8.2 });
    await step(`/api/v1/cycles/${cycle.id}/hormones`, { date: '2026-01-05', analyte: 'E2', value: 1240, unit: 'pg/mL' });
    await step(`/api/v1/cycles/${cycle.id}/oocytes`, { maturity: 'MII', count: 8 });
    await step(`/api/v1/cycles/${cycle.id}/fertilization`, { method: 'ICSI', eggsInseminated: 8, twoPnCount: 6 });
    const embryo = await step(`/api/v1/cycles/${cycle.id}/embryos`, { code: 'EMB-1', day: 3, stage: 'CLEAVAGE', grade: '8A', quality: 'GOOD' });
    await step(`/api/v1/cycles/${cycle.id}/pgt`, { embryoId: embryo.id, testType: 'PGT-A', result: 'Euploid', euploid: true });

    const embryosRes = await fetch(`${base}/api/v1/cycles/${cycle.id}/embryos`, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(embryosRes.status).toBe(200);
    const embryos = (await embryosRes.json()) as { code: string }[];
    expect(embryos.some((e) => e.code === 'EMB-1')).toBe(true);

    const cycleListRes = await fetch(`${base}/api/v1/cycles?patientId=${patient.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(cycleListRes.status).toBe(200);
    const cycles = (await cycleListRes.json()) as { id: string }[];
    expect(cycles.some((c) => c.id === cycle.id)).toBe(true);
  });

  it('creates, issues and pays an invoice idempotently, then reports revenue', async () => {
    const authed = (url: string, body?: Record<string, unknown>) =>
      fetch(`${base}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

    const servicesRes = await fetch(`${base}/api/v1/settings/services`, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(servicesRes.status).toBe(200);
    const services = (await servicesRes.json()) as { id: string }[];
    expect(services.length).toBeGreaterThan(0);

    const invoiceRes = await authed('/api/v1/finance/invoices', {
      patientId: '00000000-0000-4000-8000-000000000000',
      currency: 'TZS',
      lines: [{ serviceId: services[0].id, description: 'E2E service line', quantity: 2, unitPriceMinor: 15000, discountMinor: 0, taxRate: 18 }]
    });
    // An unknown patient must never produce a dangling invoice.
    expect(invoiceRes.status).not.toBe(201);

    const patientRes = await authed('/api/v1/patients', { firstName: 'E2E', lastName: 'Payer', sex: 'MALE', dateOfBirth: '1980-01-01' });
    expect(patientRes.status).toBe(201);
    const patient = (await patientRes.json()) as { id: string };

    const createRes = await authed('/api/v1/finance/invoices', {
      patientId: patient.id,
      currency: 'TZS',
      lines: [{ serviceId: services[0].id, description: 'E2E service line', quantity: 2, unitPriceMinor: 15000, discountMinor: 0, taxRate: 18 }]
    });
    expect(createRes.status).toBe(201);
    const invoice = (await createRes.json()) as { id: string; number: string };
    expect(invoice.number).toMatch(/^INV-\d{5}$/);

    const getInvoice = async () => {
      const r = await fetch(`${base}/api/v1/finance/invoices/${invoice.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      expect(r.status).toBe(200);
      return (await r.json()) as {
        status: string;
        grand_total_minor: number;
        paid_total_minor: number;
        lines: unknown[];
      };
    };

    const draft = await getInvoice();
    expect(draft.status).toBe('DRAFT');
    expect(draft.lines).toHaveLength(1);
    expect(draft.grand_total_minor).toBeGreaterThan(0);

    const issueRes = await authed(`/api/v1/finance/invoices/${invoice.id}/issue`);
    expect(issueRes.status).toBe(201);
    expect((await getInvoice()).status).toBe('ISSUED');

    const pay = async () =>
      authed('/api/v1/finance/payments', {
        invoiceId: invoice.id,
        amountMinor: draft.grand_total_minor,
        method: 'MOBILE_MONEY',
        idempotencyKey: 'e2e-invoice-payment'
      });
    const payRes = await pay();
    expect(payRes.status).toBe(201);
    const payment = (await payRes.json()) as { id: string; duplicate: boolean };
    expect(payment.duplicate).toBe(false);

    // Replaying the same idempotency key must not double-apply the payment.
    const replayRes = await pay();
    expect(replayRes.status).toBe(201);
    const replay = (await replayRes.json()) as { id: string; duplicate: boolean };
    expect(replay.duplicate).toBe(true);
    expect(replay.id).toBe(payment.id);

    const settled = await getInvoice();
    expect(settled.status).toBe('PAID');
    expect(settled.paid_total_minor).toBe(draft.grand_total_minor);

    const revenueRes = await fetch(`${base}/api/v1/finance/revenue`, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(revenueRes.status).toBe(200);
    const revenue = (await revenueRes.json()) as { billedTotalMinor: number; collectedTotalMinor: number };
    expect(revenue.collectedTotalMinor).toBeGreaterThanOrEqual(draft.grand_total_minor);
    expect(revenue.billedTotalMinor).toBeGreaterThanOrEqual(draft.grand_total_minor);
  });

  it('stores and transfers a cryo item under double-witness identity verification', async () => {
    const authed = (url: string, body?: Record<string, unknown>) =>
      fetch(`${base}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

    const witnessRes = await authed('/api/v1/users', {
      username: 'e2e-witness',
      password: 'WitnessPass123!',
      fullName: 'E2E Witness',
      roleKeys: ['EMBRYOLOGIST'],
      mustChangePassword: false
    });
    expect(witnessRes.status).toBe(201);
    const witness = (await witnessRes.json()) as { id: string };

    const patientRes = await authed('/api/v1/patients', { firstName: 'E2E', lastName: 'Cryo', sex: 'FEMALE', dateOfBirth: '1992-02-02' });
    expect(patientRes.status).toBe(201);
    const patient = (await patientRes.json()) as { id: string };

    const post = async (url: string, body: Record<string, unknown>) => {
      const r = await authed(url, body);
      expect(r.status).toBe(201);
      return (await r.json()) as { id: string };
    };

    const facility = await post('/api/v1/cryobank/facilities', { name: 'E2E Lab' });
    const room = await post('/api/v1/cryobank/rooms', { facilityId: facility.id, name: 'E2E Room' });
    const tank = await post('/api/v1/cryobank/tanks', { roomId: room.id, name: 'E2E Tank' });
    const canister = await post('/api/v1/cryobank/canisters', { tankId: tank.id, name: 'E2E Canister' });
    const cane = await post('/api/v1/cryobank/canes', { canisterId: canister.id, name: 'E2E Cane' });
    const goblet = await post('/api/v1/cryobank/goblets', { caneId: cane.id, name: 'E2E Goblet' });
    const rack = await post('/api/v1/cryobank/racks', { gobletId: goblet.id, name: 'E2E Rack' });
    const positionA = await post('/api/v1/cryobank/positions', { rackId: rack.id, row: 1, column: 1 });
    const positionB = await post('/api/v1/cryobank/positions', { rackId: rack.id, row: 1, column: 2 });

    const store = await authed('/api/v1/cryobank/items', {
      barcode: 'CRYO-E2E-0001',
      entityType: 'EMBRYO',
      patientId: patient.id,
      positionId: positionA.id,
      freezeAt: '2026-02-10T08:00:00Z',
      witnessUserId: witness.id
    });
    expect(store.status).toBe(201);
    const item = (await store.json()) as { id: string };

    // Identity-sensitive transfers require a second, different witness.
    const transferRes = await authed(`/api/v1/cryobank/items/${item.id}/transfer`, {
      toPositionId: positionB.id,
      witnessUserId: witness.id
    });
    expect(transferRes.status).toBe(201);

    const witnessLogRes = await fetch(`${base}/api/v1/cryobank/items/${item.id}/witness`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(witnessLogRes.status).toBe(200);
    const log = (await witnessLogRes.json()) as { event_type: string }[];
    const eventTypes = log.map((e) => e.event_type).sort();
    expect(eventTypes).toContain('CRYO_STORE');
    expect(eventTypes).toContain('CRYO_TRANSFER');
  });
});
