/**
 * Migration 0002 — clinical support modules: ultrasound/imaging and nursing.
 *
 * Adds the tables backing the imaging (ultrasound) and nursing modules. Both
 * store clinical notes as encrypted text (`*_enc`) so they are protected at
 * rest, and both reference the patient record with FK enforcement.
 */

export const clinicalSupportSchemaSql = /* sql */ `
CREATE TABLE imaging_studies (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ULTRASOUND',
  modality TEXT,
  title TEXT NOT NULL,
  study_date TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  findings_enc TEXT,
  conclusion_enc TEXT,
  performed_by TEXT,
  verified_by TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE nursing_vitals (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  systolic INTEGER,
  diastolic INTEGER,
  heart_rate INTEGER,
  temperature_c TEXT,
  weight_kg TEXT,
  height_cm TEXT,
  spo2 INTEGER,
  recorded_by TEXT,
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE nursing_notes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'ASSESSMENT',
  title TEXT,
  notes_enc TEXT,
  restricted INTEGER NOT NULL DEFAULT 0,
  recorded_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX idx_imaging_patient ON imaging_studies(patient_id);
CREATE INDEX idx_imaging_status ON imaging_studies(status);
CREATE INDEX idx_vitals_patient ON nursing_vitals(patient_id);
CREATE INDEX idx_notes_patient ON nursing_notes(patient_id);
`;
