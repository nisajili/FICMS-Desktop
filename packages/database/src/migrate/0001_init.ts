/**
 * Migration 0001 — initial FICMS schema.
 *
 * Portable dialect (SQLite + PostgreSQL):
 *   * TEXT primary keys (ids are generated in code: cuid/uuid),
 *   * INTEGER 0/1 for booleans,
 *   * TEXT ISO-8601 for timestamps,
 *   * INTEGER for monetary minor units (e.g. cents),
 *   * TEXT for serialized JSON.
 */

export const initSchemaSql = /* sql */ `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  totp_secret_enc TEXT,
  recovery_codes_hash TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  job_title TEXT,
  license_expiry_at TEXT,
  branch_id TEXT,
  department_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  refresh_hash TEXT UNIQUE,
  ip TEXT,
  user_agent TEXT,
  device_kind TEXT NOT NULL DEFAULT 'desktop',
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_active_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  branch_id TEXT,
  severity TEXT NOT NULL DEFAULT 'INFO',
  metadata TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  chain_hash TEXT,
  prev_chain_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE clinic_settings (
  id TEXT PRIMARY KEY,
  clinic_name TEXT NOT NULL DEFAULT '',
  tagline TEXT,
  legal_name TEXT,
  country TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
  locale TEXT NOT NULL DEFAULT 'en',
  languages TEXT NOT NULL DEFAULT '["en"]',
  address TEXT NOT NULL DEFAULT '{}',
  contacts TEXT NOT NULL DEFAULT '{}',
  brand TEXT NOT NULL DEFAULT '{}',
  numbering TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '{}',
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  branch_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  mrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  sex TEXT NOT NULL DEFAULT 'UNSPECIFIED',
  date_of_birth TEXT,
  national_id_enc TEXT,
  primary_phone_enc TEXT,
  email_enc TEXT,
  address_enc TEXT,
  blood_group TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  branch_id TEXT,
  referred_by_id TEXT,
  referral_note TEXT,
  duplicate_of_id TEXT,
  merged_into_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (referred_by_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY (duplicate_of_id) REFERENCES patients(id) ON DELETE SET NULL
);

CREATE TABLE partner_links (
  id TEXT PRIMARY KEY,
  primary_patient_id TEXT NOT NULL,
  secondary_patient_id TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'PARTNER',
  created_at TEXT NOT NULL,
  UNIQUE (primary_patient_id, secondary_patient_id),
  FOREIGN KEY (primary_patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (secondary_patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  referred_by_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  provider_id TEXT,
  branch_id TEXT,
  type TEXT NOT NULL DEFAULT 'CONSULTATION',
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  queue_token TEXT,
  notes TEXT,
  checked_in_at TEXT,
  checked_out_at TEXT,
  client_ref TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE clinical_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'CONSULTATION',
  body TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  version INTEGER NOT NULL DEFAULT 1,
  author_id TEXT NOT NULL,
  signed_by_id TEXT,
  signed_at TEXT,
  supersedes_id TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (signed_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE clinical_record_versions (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  body TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  author_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (record_id, version),
  FOREIGN KEY (record_id) REFERENCES clinical_records(id) ON DELETE CASCADE
);

CREATE TABLE e_signatures (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  signed_by_id TEXT NOT NULL,
  signature_digest TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'clinical',
  signed_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES clinical_records(id) ON DELETE CASCADE
);

CREATE TABLE consultation_notes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  cycle_id TEXT,
  author_id TEXT NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  version INTEGER NOT NULL DEFAULT 1,
  signed_by_id TEXT,
  signed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE clinical_alerts (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE diagnoses (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  code TEXT,
  description TEXT NOT NULL,
  onset_date TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE treatment_plans (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  approved_by_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  medication TEXT NOT NULL,
  dose TEXT,
  route TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  prescribed_by_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (prescribed_by_id) REFERENCES users(id)
);

CREATE TABLE investigations (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  test_catalog_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ORDERED',
  ordered_by_id TEXT NOT NULL,
  cycle_id TEXT,
  clinical_note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (test_catalog_id) REFERENCES test_catalog(id)
);

CREATE TABLE treatment_cycles (
  id TEXT PRIMARY KEY,
  cycle_number TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL,
  partner_patient_id TEXT,
  type TEXT NOT NULL DEFAULT 'IVF',
  status TEXT NOT NULL DEFAULT 'PLANNED',
  protocol_id TEXT,
  start_date TEXT,
  clinician_id TEXT,
  embryologist_id TEXT,
  outcome TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE cycle_timeline_events (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  critical INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  occurred_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES treatment_cycles(id) ON DELETE CASCADE
);

CREATE TABLE follicle_measurements (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  date TEXT NOT NULL,
  ovary TEXT NOT NULL DEFAULT 'LEFT',
  count INTEGER NOT NULL DEFAULT 0,
  sizes_mm TEXT NOT NULL DEFAULT '[]',
  endometrium_mm REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES treatment_cycles(id) ON DELETE CASCADE
);

CREATE TABLE hormone_results (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  date TEXT NOT NULL,
  analyte TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  reference_range TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES treatment_cycles(id) ON DELETE CASCADE
);

CREATE TABLE oocyte_records (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  maturity TEXT NOT NULL DEFAULT 'MII',
  count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES treatment_cycles(id) ON DELETE CASCADE
);

CREATE TABLE fertilization_records (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'ICSI',
  eggs_inseminated INTEGER NOT NULL DEFAULT 0,
  two_pn_count INTEGER,
  abnormal_fertilization INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES treatment_cycles(id) ON DELETE CASCADE
);

CREATE TABLE embryo_records (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  day INTEGER NOT NULL,
  stage TEXT NOT NULL,
  grade TEXT,
  quality TEXT,
  assisted_hatching INTEGER NOT NULL DEFAULT 0,
  biopsied INTEGER NOT NULL DEFAULT 0,
  frozen INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES treatment_cycles(id) ON DELETE CASCADE
);

CREATE TABLE pgt_records (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  embryo_id TEXT NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'PGT-A',
  result TEXT,
  euploid INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES treatment_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (embryo_id) REFERENCES embryo_records(id) ON DELETE CASCADE
);

CREATE TABLE semen_samples (
  id TEXT PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  collection_method TEXT NOT NULL DEFAULT 'CLINIC',
  abstinence_days INTEGER,
  chain_of_custody TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE semen_analyses (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  volume_ml REAL,
  concentration_million_per_ml REAL,
  total_motility_percent REAL,
  progressive_motility_percent REAL,
  morphology_normal_percent REAL,
  result_status TEXT NOT NULL DEFAULT 'DRAFT',
  analyzed_by_id TEXT NOT NULL,
  verified_by_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sample_id) REFERENCES semen_samples(id) ON DELETE CASCADE
);

CREATE TABLE sperm_preps (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'DENSITY_GRADIENT',
  post_wash_concentration REAL,
  post_wash_motility REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sample_id) REFERENCES semen_samples(id) ON DELETE CASCADE
);

CREATE TABLE dna_fragmentations (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  percent_dfi REAL,
  method TEXT NOT NULL DEFAULT 'SCD',
  created_at TEXT NOT NULL,
  FOREIGN KEY (sample_id) REFERENCES semen_samples(id) ON DELETE CASCADE
);

CREATE TABLE test_catalog (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'BIOCHEMISTRY',
  unit TEXT,
  reference_low REAL,
  reference_high REAL,
  reference_text TEXT,
  critical_low REAL,
  critical_high REAL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE sample_accessions (
  id TEXT PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  collected_by_id TEXT,
  status TEXT NOT NULL DEFAULT 'COLLECTED',
  created_at TEXT NOT NULL
);

CREATE TABLE sample_accession_items (
  id TEXT PRIMARY KEY,
  accession_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  FOREIGN KEY (accession_id) REFERENCES sample_accessions(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES test_catalog(id)
);

CREATE TABLE lab_results (
  id TEXT PRIMARY KEY,
  investigation_id TEXT,
  test_id TEXT NOT NULL,
  value REAL,
  value_text TEXT,
  unit TEXT,
  flag TEXT,
  status TEXT NOT NULL DEFAULT 'ENTERED',
  entered_by_id TEXT NOT NULL,
  verified_by_id TEXT,
  released_by_id TEXT,
  verified_at TEXT,
  released_at TEXT,
  critical_alert_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES test_catalog(id)
);

CREATE TABLE qc_log_entries (
  id TEXT PRIMARY KEY,
  equipment TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'CALIBRATION',
  result TEXT NOT NULL,
  performed_by_id TEXT NOT NULL,
  performed_at TEXT NOT NULL
);

CREATE TABLE equipment_maintenance (
  id TEXT PRIMARY KEY,
  equipment TEXT NOT NULL,
  task TEXT NOT NULL,
  due_date TEXT NOT NULL,
  completed_at TEXT,
  performed_by_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE cryo_facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE cryo_rooms (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (facility_id) REFERENCES cryo_facilities(id) ON DELETE CASCADE
);

CREATE TABLE cryo_tanks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_SERVICE',
  capacity_slots INTEGER NOT NULL DEFAULT 100,
  FOREIGN KEY (room_id) REFERENCES cryo_rooms(id) ON DELETE CASCADE
);

CREATE TABLE cryo_canisters (
  id TEXT PRIMARY KEY,
  tank_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (tank_id) REFERENCES cryo_tanks(id) ON DELETE CASCADE
);

CREATE TABLE cryo_canes (
  id TEXT PRIMARY KEY,
  canister_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (canister_id) REFERENCES cryo_canisters(id) ON DELETE CASCADE
);

CREATE TABLE cryo_goblets (
  id TEXT PRIMARY KEY,
  cane_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (cane_id) REFERENCES cryo_canes(id) ON DELETE CASCADE
);

CREATE TABLE cryo_racks (
  id TEXT PRIMARY KEY,
  goblet_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (goblet_id) REFERENCES cryo_goblets(id) ON DELETE CASCADE
);

CREATE TABLE cryo_positions (
  id TEXT PRIMARY KEY,
  rack_id TEXT NOT NULL,
  row INTEGER,
  column INTEGER,
  path TEXT NOT NULL UNIQUE,
  FOREIGN KEY (rack_id) REFERENCES cryo_racks(id) ON DELETE CASCADE
);

CREATE TABLE cryo_items (
  id TEXT PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL DEFAULT 'EMBRYO',
  patient_id TEXT NOT NULL,
  cycle_id TEXT,
  embryo_id TEXT,
  position_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'STORED',
  freeze_at TEXT NOT NULL,
  released_at TEXT,
  disposed_at TEXT,
  consent_doc_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (embryo_id) REFERENCES embryo_records(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES cryo_positions(id)
);

CREATE TABLE cryo_transfers (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  from_position_id TEXT NOT NULL,
  to_position_id TEXT NOT NULL,
  reason TEXT,
  performed_by_id TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES cryo_items(id) ON DELETE CASCADE
);

CREATE TABLE temperature_logs (
  id TEXT PRIMARY KEY,
  tank_id TEXT NOT NULL,
  temperature_k REAL NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (tank_id) REFERENCES cryo_tanks(id) ON DELETE CASCADE
);

CREATE TABLE storage_agreements (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  item_ids TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  signed_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE medication_catalog (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  form TEXT,
  strength TEXT,
  controlled_substance INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE stock_items (
  id TEXT PRIMARY KEY,
  medication_id TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  expiry_date TEXT,
  location TEXT,
  min_stock INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (medication_id) REFERENCES medication_catalog(id)
);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  stock_item_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reference TEXT,
  reason TEXT,
  performed_by_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE
);

CREATE TABLE dispensings (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  stock_item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  partial INTEGER NOT NULL DEFAULT 0,
  dispensed_by_id TEXT NOT NULL,
  verified_by_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
  FOREIGN KEY (stock_item_id) REFERENCES stock_items(id)
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT
);

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE purchase_order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  medication_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost_minor INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (medication_id) REFERENCES medication_catalog(id)
);

CREATE TABLE service_catalog (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  price_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE treatment_packages (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_minor INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE package_items (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (package_id) REFERENCES treatment_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES service_catalog(id)
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  sub_total_minor INTEGER NOT NULL DEFAULT 0,
  discount_total_minor INTEGER NOT NULL DEFAULT 0,
  tax_total_minor INTEGER NOT NULL DEFAULT 0,
  grand_total_minor INTEGER NOT NULL DEFAULT 0,
  paid_total_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  issued_at TEXT,
  due_date TEXT,
  void_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  line_total_minor INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES service_catalog(id)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'CASH',
  reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  received_at TEXT NOT NULL,
  recorded_by_id TEXT NOT NULL,
  voided INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (recorded_by_id) REFERENCES users(id)
);

CREATE TABLE credit_notes (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  number TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE installments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  due_date TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE cashier_shifts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_float_minor INTEGER NOT NULL DEFAULT 0,
  closing_cash_minor INTEGER,
  expected_cash_minor INTEGER,
  status TEXT NOT NULL DEFAULT 'OPEN',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE insurance_claims (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  insurer TEXT NOT NULL,
  policy_number TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  amount_minor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE counseling_sessions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'PRE_TREATMENT',
  notes_enc TEXT,
  restricted INTEGER NOT NULL DEFAULT 0,
  counselor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE donors (
  id TEXT PRIMARY KEY,
  donor_code TEXT NOT NULL UNIQUE,
  identity_enc TEXT,
  status TEXT NOT NULL DEFAULT 'SCREENING',
  created_at TEXT NOT NULL
);

CREATE TABLE donations (
  id TEXT PRIMARY KEY,
  donor_id TEXT NOT NULL,
  sample_barcode TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (donor_id) REFERENCES donors(id)
);

CREATE TABLE staff_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  employee_number TEXT,
  department TEXT,
  job_title TEXT,
  hire_date TEXT,
  qualifications TEXT NOT NULL DEFAULT '[]',
  license_expiry_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
);

CREATE TABLE leave_records (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ANNUAL',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
);

CREATE TABLE payroll_records (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  period TEXT NOT NULL,
  gross_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE
);

CREATE TABLE file_documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  ref_type TEXT NOT NULL DEFAULT 'GENERAL',
  ref_id TEXT,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  sha256 TEXT,
  uploaded_by_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE form_templates (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'CLINICAL',
  schema TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE form_submissions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  signed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES form_templates(id)
);

CREATE TABLE consent_templates (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  patient_id TEXT,
  user_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'IN_APP',
  sent_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  patient_id TEXT,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  enabled INTEGER NOT NULL DEFAULT 1,
  scope TEXT NOT NULL DEFAULT 'APPOINTMENTS'
);

CREATE TABLE witness_verifications (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  primary_user_id TEXT NOT NULL,
  witness_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (witness_user_id) REFERENCES users(id)
);

CREATE TABLE sync_operations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  queued_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE TABLE sync_journal_entries (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  last_server_timestamp TEXT NOT NULL,
  pulled_at TEXT NOT NULL,
  pushed_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE conflict_records (
  id TEXT PRIMARY KEY,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  local_version INTEGER NOT NULL DEFAULT 1,
  remote_version INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_events(created_at);
CREATE INDEX idx_patients_name_key ON patients(name_key);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_starts ON appointments(starts_at);
CREATE INDEX idx_appointments_provider ON appointments(provider_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_clinical_patient ON clinical_records(patient_id);
CREATE INDEX idx_clinical_status ON clinical_records(status);
CREATE INDEX idx_cycles_patient ON treatment_cycles(patient_id);
CREATE INDEX idx_embryos_cycle ON embryo_records(cycle_id);
CREATE INDEX idx_cryo_items_patient ON cryo_items(patient_id);
CREATE INDEX idx_cryo_items_position ON cryo_items(position_id);
CREATE INDEX idx_cryo_items_status ON cryo_items(status);
CREATE INDEX idx_stock_medication ON stock_items(medication_id);
CREATE INDEX idx_invoices_patient ON invoices(patient_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_sync_client_status ON sync_operations(client_id, status);
CREATE INDEX idx_lab_status ON lab_results(status);
`;
