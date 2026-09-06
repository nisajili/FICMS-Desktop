import type { Permission, Resource, Role, RoleDefinition } from '@ficms/types';

const all = (r: Resource, extra: Permission[] = []): Permission[] =>
  ([
    `${r}:view`,
    `${r}:create`,
    `${r}:update`,
    `${r}:sign`,
    `${r}:verify`,
    `${r}:approve`,
    `${r}:release`,
    `${r}:correct`,
    `${r}:export`,
    `${r}:print`,
    `${r}:archive`,
    `${r}:cancel`,
    `${r}:refund`,
    `${r}:transfer`,
    `${r}:dispose`
  ] as Permission[]).concat(extra);

const clinical = (r: Resource): Permission[] => [
  `${r}:view`,
  `${r}:create`,
  `${r}:update`,
  `${r}:sign`,
  `${r}:correct`,
  `${r}:print`,
  `${r}:archive`
];

/**
 * Default role definitions. Every role is configurable in the admin workspace;
 * this matrix is the shipped baseline and is also used to seed fresh installs.
 */
export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  SYSTEM_ADMINISTRATOR: {
    key: 'SYSTEM_ADMINISTRATOR',
    label: 'System Administrator',
    description: 'Full platform control including users, roles, integrations and backups.',
    permissions: ['*'],
    system: true
  },
  CLINIC_OWNER: {
    key: 'CLINIC_OWNER',
    label: 'Clinic Owner',
    description: 'Oversight of the entire clinic; no routine clinical signing.',
    permissions: [
      ...all('patient'),
      ...all('appointment'),
      ...all('finance'),
      ...all('report'),
      ...all('inventory'),
      ...all('cryobank'),
      'clinical_record:view',
      'laboratory:view',
      'settings:view',
      'settings:update',
      'user:view',
      'user:create',
      'audit_log:view',
      'backup:view',
      'backup:create'
    ],
    system: true
  },
  CLINIC_DIRECTOR: {
    key: 'CLINIC_DIRECTOR',
    label: 'Clinic Director',
    description: 'Clinical and operational leadership with approval authority.',
    permissions: [
      ...all('patient'),
      ...all('appointment'),
      ...clinical('clinical_record'),
      ...clinical('consultation'),
      ...all('laboratory'),
      ...all('report'),
      'finance:view',
      'finance:approve',
      'settings:view',
      'audit_log:view'
    ],
    system: true
  },
  CLINIC_ADMINISTRATOR: {
    key: 'CLINIC_ADMINISTRATOR',
    label: 'Clinic Administrator',
    description: 'Day-to-day administration and configuration.',
    permissions: [
      ...all('patient'),
      ...all('appointment'),
      ...all('finance'),
      ...all('inventory'),
      'clinical_record:view',
      'laboratory:view',
      'settings:view',
      'settings:update',
      'user:view',
      'user:create',
      'user:update',
      'report:view',
      'report:export'
    ],
    system: true
  },
  RECEPTIONIST: {
    key: 'RECEPTIONIST',
    label: 'Receptionist',
    description: 'Front-desk registration, scheduling and check-in.',
    permissions: [
      'patient:view',
      'patient:create',
      'patient:update',
      'appointment:view',
      'appointment:create',
      'appointment:update',
      'appointment:cancel',
      'finance:view',
      'finance:create',
      'finance:print'
    ],
    system: true
  },
  FERTILITY_SPECIALIST: {
    key: 'FERTILITY_SPECIALIST',
    label: 'Fertility Specialist',
    description: 'Lead clinician for ART treatment cycles.',
    permissions: [
      ...all('patient'),
      ...clinical('consultation'),
      ...clinical('clinical_record'),
      ...clinical('treatment_plan'),
      ...clinical('prescription'),
      ...clinical('investigation'),
      'laboratory:view',
      'laboratory:release',
      'imaging:view',
      'imaging:create',
      'cryobank:view',
      'cryobank:approve'
    ],
    system: true
  },
  DOCTOR: {
    key: 'DOCTOR',
    label: 'Doctor',
    description: 'General clinician role.',
    permissions: [
      'patient:view',
      'patient:create',
      'consultation:view',
      'consultation:create',
      'consultation:update',
      'consultation:sign',
      'clinical_record:view',
      'clinical_record:create',
      'clinical_record:update',
      'clinical_record:sign',
      'prescription:view',
      'prescription:create',
      'prescription:sign',
      'investigation:view',
      'investigation:create',
      'laboratory:view'
    ],
    system: true
  },
  EMBRYOLOGIST: {
    key: 'EMBRYOLOGIST',
    label: 'Embryologist',
    description: 'Embryology laboratory workflows with double-witness verification.',
    permissions: [
      'embryology:view',
      'embryology:create',
      'embryology:update',
      'embryology:verify',
      'embryology:sign',
      'embryology:release',
      'laboratory:view',
      'laboratory:create',
      'laboratory:update',
      'laboratory:verify',
      'laboratory:sign',
      'cryobank:view',
      'cryobank:create',
      'cryobank:update',
      'cryobank:verify',
      'cryobank:transfer',
      'donor:view',
      'donor:create',
      'donor:update',
      'patient:view'
    ],
    system: true
  },
  ANDROLOGIST: {
    key: 'ANDROLOGIST',
    label: 'Andrologist',
    description: 'Semen analysis and sperm preparation workflows.',
    permissions: [
      'andrology:view',
      'andrology:create',
      'andrology:update',
      'andrology:verify',
      'andrology:sign',
      'andrology:release',
      'laboratory:view',
      'laboratory:verify',
      'cryobank:view',
      'cryobank:create',
      'cryobank:verify',
      'donor:view',
      'donor:create',
      'patient:view'
    ],
    system: true
  },
  LABORATORY_SCIENTIST: {
    key: 'LABORATORY_SCIENTIST',
    label: 'Laboratory Scientist',
    description: 'General laboratory testing and quality control.',
    permissions: [
      'laboratory:view',
      'laboratory:create',
      'laboratory:update',
      'laboratory:verify',
      'laboratory:sign',
      'investigation:view',
      'investigation:update',
      'patient:view'
    ],
    system: true
  },
  SONOGRAPHER: {
    key: 'SONOGRAPHER',
    label: 'Sonographer',
    description: 'Ultrasound scanning and structured reporting.',
    permissions: [
      'imaging:view',
      'imaging:create',
      'imaging:update',
      'imaging:verify',
      'patient:view',
      'clinical_record:view'
    ],
    system: true
  },
  NURSE: {
    key: 'NURSE',
    label: 'Nurse',
    description: 'Nursing care, vitals, injections and education.',
    permissions: [
      'nursing:view',
      'nursing:create',
      'nursing:update',
      'nursing:sign',
      'patient:view',
      'patient:update',
      'prescription:view',
      'prescription:update',
      'investigation:view',
      'investigation:create'
    ],
    system: true
  },
  PHARMACIST: {
    key: 'PHARMACIST',
    label: 'Pharmacist',
    description: 'Pharmacy verification and dispensing.',
    permissions: [
      'pharmacy:view',
      'pharmacy:create',
      'pharmacy:update',
      'pharmacy:verify',
      'pharmacy:sign',
      'inventory:view',
      'inventory:create',
      'inventory:update',
      'inventory:transfer',
      'prescription:view',
      'prescription:update'
    ],
    system: true
  },
  COUNSELOR: {
    key: 'COUNSELOR',
    label: 'Counselor / Psychologist',
    description: 'Counseling sessions with confidential, restricted notes.',
    permissions: [
      'counseling:view',
      'counseling:create',
      'counseling:update',
      'counseling:sign',
      'patient:view'
    ],
    system: true
  },
  CASHIER: {
    key: 'CASHIER',
    label: 'Cashier',
    description: 'Payments, receipts and cashier shifts.',
    permissions: [
      'finance:view',
      'finance:create',
      'finance:update',
      'finance:refund',
      'finance:print',
      'billing:view',
      'patient:view'
    ],
    system: true
  },
  FINANCE_OFFICER: {
    key: 'FINANCE_OFFICER',
    label: 'Finance Officer',
    description: 'Invoices, credit notes, reconciliation and revenue reporting.',
    permissions: [
      ...all('finance'),
      ...all('report'),
      'billing:view',
      'patient:view'
    ],
    system: true
  },
  INVENTORY_OFFICER: {
    key: 'INVENTORY_OFFICER',
    label: 'Inventory Officer',
    description: 'Stock, purchase orders and suppliers.',
    permissions: [...all('inventory'), 'pharmacy:view', 'patient:view'],
    system: true
  },
  HUMAN_RESOURCES_OFFICER: {
    key: 'HUMAN_RESOURCES_OFFICER',
    label: 'Human Resources Officer',
    description: 'Staff records, attendance, leave and payroll.',
    permissions: ['hr:view', 'hr:create', 'hr:update', 'hr:administer', 'user:view'],
    system: true
  },
  AUDITOR: {
    key: 'AUDITOR',
    label: 'Auditor / Compliance Officer',
    description: 'Read-only access to audit logs and clinical records.',
    permissions: [
      'audit_log:view',
      'audit_log:export',
      'clinical_record:view',
      'laboratory:view',
      'cryobank:view',
      'finance:view',
      'report:view',
      'report:export',
      'settings:view'
    ],
    system: true
  },
  PATIENT: {
    key: 'PATIENT',
    label: 'Patient',
    description: 'Patient portal: view own records, appointments, forms and invoices.',
    permissions: [
      'appointment:view',
      'appointment:create',
      'appointment:update',
      'appointment:cancel',
      'clinical_record:view',
      'finance:view'
    ],
    system: true
  }
};

export const DEFAULT_PERMISSION_SET: Permission[] = Object.values(ROLE_DEFINITIONS).flatMap(
  (d) => d.permissions
);

export function roleLabel(role: Role): string {
  return ROLE_DEFINITIONS[role]?.label ?? role;
}
