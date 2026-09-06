/**
 * FICMS seed script (runs via `pnpm db:seed` or the standalone bootstrap).
 * Idempotent; seeds roles, admin user, clinic defaults and a synthetic demo
 * dataset. Never uses real patient information.
 */
import { openDatabase } from './db';
import { Repositories } from './repository';
import { ensureDefaults } from './repository/org';
import { hashPassword } from '@ficms/security';
import { ROLE_DEFINITIONS } from '@ficms/domain';
import type { Role } from '@ficms/types';

const ADMIN_USERNAME = process.env.FICMS_SEED_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.FICMS_SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const CLINIC_NAME = process.env.FICMS_SEED_CLINIC_NAME ?? 'Fertility & IVF Centre';

export interface SeedResult {
  adminUsername: string;
  adminCreated: boolean;
  branchId: string;
}

export async function seedDatabase(repos: Repositories, adminPassword = ADMIN_PASSWORD): Promise<SeedResult> {
  // Roles.
  for (const def of Object.values(ROLE_DEFINITIONS)) {
    await repos.roles.upsertByKey({ key: def.key as Role, label: def.label, description: def.description, permissions: def.permissions, system: def.system });
  }

  // Settings. Preserve any already-advanced numbering counters (idempotent re-runs).
  const current = await repos.settings.get();
  let numbering: Record<string, unknown> = {};
  try {
    numbering = JSON.parse(current.numbering ?? '{}');
  } catch {
    numbering = {};
  }
  numbering = {
    ...numbering,
    mrnPrefix: 'MRN-',
    invoicePrefix: 'INV-',
    cyclePrefix: 'CYC-',
    samplePrefix: 'SMP-'
  };
  await repos.settings.update({
    clinicName: CLINIC_NAME,
    country: 'TZ',
    currency: 'TZS',
    timezone: 'Africa/Dar_es_Salaam',
    locale: 'en',
    languages: JSON.stringify(['en', 'sw']),
    brand: JSON.stringify({ primaryColor: '#0e7490', secondaryColor: '#0f766e' }),
    numbering: JSON.stringify(numbering)
  });

  // Branch.
  let branchId = (await repos.branches.list())[0]?.id as string | undefined;
  if (!branchId) {
    branchId = await repos.branches.create({ name: 'Main Clinic', code: 'MAIN' });
  }

  // Admin user.
  let adminCreated = false;
  const existing = await repos.users.findByUsername(ADMIN_USERNAME);
  if (!existing) {
    const adminRole = await repos.roles.findByKey('SYSTEM_ADMINISTRATOR');
    if (adminRole) {
      const passwordHash = await hashPassword(adminPassword);
      await repos.users.create({
        username: ADMIN_USERNAME,
        fullName: 'System Administrator',
        passwordHash,
        mustChangePassword: true,
        branchId,
        roleIds: [adminRole.id]
      });
      adminCreated = true;
    }
  }

  // Catalogs.
  if ((await repos.services.list()).length === 0) {
    const services = [
      { code: 'CONS-INITIAL', name: 'Initial Consultation', category: 'CONSULTATION', priceMinor: 50000 },
      { code: 'CONS-FOLLOW', name: 'Follow-up Consultation', category: 'CONSULTATION', priceMinor: 30000 },
      { code: 'US-FOLLICULAR', name: 'Follicular Ultrasound Scan', category: 'IMAGING', priceMinor: 60000 },
      { code: 'LAB-SEMEN', name: 'Semen Analysis', category: 'LABORATORY', priceMinor: 40000 },
      { code: 'LAB-HORMONE', name: 'Hormone Assay (AMH)', category: 'LABORATORY', priceMinor: 90000 },
      { code: 'ART-IVF', name: 'IVF Cycle', category: 'ART', priceMinor: 5000000 },
      { code: 'ART-ICSI', name: 'ICSI Cycle', category: 'ART', priceMinor: 5500000 },
      { code: 'ART-IUI', name: 'IUI Cycle', category: 'ART', priceMinor: 800000 },
      { code: 'CRYO-STORAGE', name: 'Embryo Cryostorage (annual)', category: 'CRYO', priceMinor: 200000 }
    ];
    for (const s of services) await repos.services.create(s);
  }

  if ((await repos.tests.list()).length === 0) {
    const tests = [
      { code: 'AMH', name: 'Anti-Müllerian Hormone', category: 'HORMONE', unit: 'ng/mL', referenceLow: 1.0, referenceHigh: 4.0 },
      { code: 'FSH', name: 'Follicle Stimulating Hormone', category: 'HORMONE', unit: 'IU/L', referenceLow: 3.5, referenceHigh: 12.5 },
      { code: 'LH', name: 'Luteinizing Hormone', category: 'HORMONE', unit: 'IU/L' },
      { code: 'E2', name: 'Estradiol', category: 'HORMONE', unit: 'pg/mL' },
      { code: 'PROG', name: 'Progesterone', category: 'HORMONE', unit: 'ng/mL' },
      { code: 'HBsAg', name: 'Hepatitis B surface antigen', category: 'INFECTIOUS', unit: 'IU/mL' },
      { code: 'HCV', name: 'Hepatitis C antibody', category: 'INFECTIOUS' },
      { code: 'HIV', name: 'HIV 1/2 antibody', category: 'INFECTIOUS' },
      { code: 'RPR', name: 'Syphilis (RPR)', category: 'INFECTIOUS' },
      { code: 'FBC', name: 'Full Blood Count', category: 'HEMATOLOGY' }
    ];
    for (const t of tests) await repos.tests.create(t);
  }

  if ((await repos.medications.list()).length === 0) {
    const meds = [
      { code: 'GON-FSH', name: 'Follitropin alfa (r-hFSH)', form: 'injection', strength: '300 IU' },
      { code: 'GON-HMG', name: 'Menotropin (hMG)', form: 'injection', strength: '75 IU' },
      { code: 'ANT-GAN', name: 'Ganirelix acetate', form: 'injection', strength: '0.25 mg' },
      { code: 'ANT-CET', name: 'Cetrorelix acetate', form: 'injection', strength: '0.25 mg' },
      { code: 'TRG-HCG', name: 'Chorionic gonadotropin (hCG)', form: 'injection', strength: '5000 IU' },
      { code: 'TRG-TRIP', name: 'Triptorelin acetate', form: 'injection', strength: '0.1 mg' },
      { code: 'LUT-PROG', name: 'Progesterone (vaginal)', form: 'pessary', strength: '400 mg' },
      { code: 'OCP', name: 'Combined oral contraceptive', form: 'tablet' }
    ];
    for (const m of meds) await repos.medications.create(m);
  }

  // Synthetic demo patient (allocates its MRN through the numbering series so
  // subsequent registrations never collide).
  const patients = await repos.patients.list(1, 1);
  if (patients.total === 0) {
    const mrn = await repos.settings.nextNumber('mrn', 'MRN-', 5);
    await repos.patients.create({
      mrn,
      firstName: 'Synthetic',
      lastName: 'Demo Patient',
      sex: 'FEMALE',
      dateOfBirth: '1990-01-15',
      bloodGroup: 'O+',
      branchId,
      addressEnc: JSON.stringify({ city: 'Demo City' })
    });
  }

  return { adminUsername: ADMIN_USERNAME, adminCreated, branchId };
}

async function main(): Promise<void> {
  const db = await openDatabase();
  try {
    const repos = new Repositories(db.engine);
    await ensureDefaults(db.engine);
    const result = await seedDatabase(repos, ADMIN_PASSWORD);
    console.log(`[seed] Done. admin="${result.adminUsername}" created=${result.adminCreated}`);
  } finally {
    await db.close();
  }
}

// Run only when executed directly (e.g. `tsx src/seed.ts`).
if (process.argv[1]?.endsWith('seed.ts')) {
  main().catch((err) => {
    console.error('[seed] Failed:', err);
    process.exitCode = 1;
  });
}
