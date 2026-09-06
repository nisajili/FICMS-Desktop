/** Thin typed client for the versioned FICMS REST API (/api/v1). */

export interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  branchId: string | null;
  departmentId: string | null;
  jobTitle: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: PublicUser;
}

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: string;
  dateOfBirth: string | null;
  primaryPhone: string | null;
  email: string | null;
  bloodGroup: string | null;
  status: string;
  createdAt?: string;
}

export interface PatientPage {
  total: number;
  page: number;
  pageSize: number;
  items: Patient[];
}

export interface Branding {
  clinicName: string;
  tagline: string | null;
  legalName: string | null;
  country: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  locale: string;
  languages: string[];
}

export interface HealthResponse {
  status: string;
  provider: string;
}

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  category: string | null;
  price_minor?: number;
  priceMinor?: number;
}

export interface TestItem {
  id: string;
  code: string;
  name: string;
}

export interface MedicationItem {
  id: string;
  code?: string;
  name: string;
}

export type Row = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let cachedBase: string | null = null;

/** Resolve the API base URL once (absolute in Electron, relative in preview). */
export async function resolveApiBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  try {
    const runtime = window.ficms?.runtime;
    if (runtime) {
      const cfg = await runtime();
      cachedBase = cfg.apiBaseUrl.replace(/\/$/, '');
      return cachedBase;
    }
  } catch {
    /* fall through to relative base */
  }
  cachedBase = '/api/v1';
  return cachedBase;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  raw?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = await resolveApiBase();
  const res = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (options.raw) return res as T;

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const data = (await res.json()) as { message?: string | string[]; code?: string };
      if (Array.isArray(data.message)) message = data.message.join('; ') || message;
      else if (data.message) message = data.message;
      code = data.code;
    } catch {
      /* keep default message */
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // --- system ---
  health: () => request<HealthResponse>('/health'),
  branding: () => request<Branding>('/settings/branding'),

  // --- auth ---
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password } }),
  me: (token: string) => request<PublicUser>('/auth/me', { token }),
  logout: (token: string) => request<void>('/auth/logout', { method: 'POST', token }),

  // --- patients & appointments ---
  patients: (token: string, page = 1, pageSize = 25) =>
    request<PatientPage>(`/patients?page=${page}&pageSize=${pageSize}`, { token }),
  registerPatient: (token: string, body: Record<string, unknown>) =>
    request<Patient & { duplicateCandidates: unknown[] }>('/patients', { method: 'POST', token, body }),
  scheduleAppointment: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/patients/appointments', { method: 'POST', token, body }),
  appointments: (token: string, patientId: string) =>
    request<Row[]>(`/patients/${patientId}/appointments`, { token }),

  // --- clinical (EMR) ---
  createRecord: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/clinical/records', { method: 'POST', token, body }),
  records: (token: string, patientId: string) =>
    request<Row[]>(`/clinical/patients/${patientId}/records`, { token }),
  createConsultation: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/clinical/consultations', { method: 'POST', token, body }),
  consultations: (token: string, patientId: string) =>
    request<Row[]>(`/clinical/patients/${patientId}/consultations`, { token }),
  createDiagnosis: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/clinical/diagnoses', { method: 'POST', token, body }),
  diagnoses: (token: string, patientId: string) =>
    request<Row[]>(`/clinical/patients/${patientId}/diagnoses`, { token }),
  createPrescription: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/clinical/prescriptions', { method: 'POST', token, body }),
  prescriptions: (token: string, patientId: string) =>
    request<Row[]>(`/clinical/patients/${patientId}/prescriptions`, { token }),
  createInvestigation: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/clinical/investigations', { method: 'POST', token, body }),
  investigations: (token: string, patientId: string) =>
    request<Row[]>(`/clinical/patients/${patientId}/investigations`, { token }),

  // --- ART cycles ---
  cycles: (token: string, patientId?: string) =>
    request<Row[]>(`/cycles${patientId ? `?patientId=${patientId}` : ''}`, { token }),
  createCycle: (token: string, body: Record<string, unknown>) =>
    request<Row>(`/cycles`, { method: 'POST', token, body }),
  addFollicles: (token: string, cycleId: string, body: Record<string, unknown>) =>
    request<{ id: string }>(`/cycles/${cycleId}/follicles`, { method: 'POST', token, body }),
  addHormones: (token: string, cycleId: string, body: Record<string, unknown>) =>
    request<{ id: string }>(`/cycles/${cycleId}/hormones`, { method: 'POST', token, body }),
  addOocytes: (token: string, cycleId: string, body: Record<string, unknown>) =>
    request<{ id: string }>(`/cycles/${cycleId}/oocytes`, { method: 'POST', token, body }),
  recordFertilization: (token: string, cycleId: string, body: Record<string, unknown>) =>
    request<{ id: string }>(`/cycles/${cycleId}/fertilization`, { method: 'POST', token, body }),
  addEmbryo: (token: string, cycleId: string, body: Record<string, unknown>) =>
    request<{ id: string }>(`/cycles/${cycleId}/embryos`, { method: 'POST', token, body }),
  embryos: (token: string, cycleId: string) => request<Row[]>(`/cycles/${cycleId}/embryos`, { token }),
  addPgt: (token: string, cycleId: string, body: Record<string, unknown>) =>
    request<{ id: string }>(`/cycles/${cycleId}/pgt`, { method: 'POST', token, body }),
  pgt: (token: string, cycleId: string) => request<Row[]>(`/cycles/${cycleId}/pgt`, { token }),

  // --- laboratory ---
  createSample: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/laboratory/samples', { method: 'POST', token, body }),
  addAnalysis: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/laboratory/analyses', { method: 'POST', token, body }),
  labResults: (token: string, patientId: string) =>
    request<Row[]>(`/laboratory/results?patientId=${patientId}`, { token }),
  logQc: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/laboratory/qc', { method: 'POST', token, body }),
  qcList: (token: string) => request<Row[]>('/laboratory/qc', { token }),

  // --- cryobank ---
  cryoHierarchy: (token: string) => request<Row>('/cryobank/hierarchy', { token }),
  cryoItems: (token: string) => request<Row[]>('/cryobank/items', { token }),
  cryoPost: (token: string, path: string, body: Record<string, unknown>) =>
    request<Row>(`/cryobank/${path}`, { method: 'POST', token, body }),
  cryoStore: (token: string, body: Record<string, unknown>) =>
    request<Row>('/cryobank/items', { method: 'POST', token, body }),
  cryoTransfer: (token: string, itemId: string, body: Record<string, unknown>) =>
    request<Row>(`/cryobank/items/${itemId}/transfer`, { method: 'POST', token, body }),

  // --- finance ---
  invoices: (token: string, patientId?: string) =>
    request<Row[]>(`/finance/invoices${patientId ? `?patientId=${patientId}` : ''}`, { token }),
  createInvoice: (token: string, body: Record<string, unknown>) =>
    request<Row>('/finance/invoices', { method: 'POST', token, body }),
  issueInvoice: (token: string, id: string) =>
    request<Row>(`/finance/invoices/${id}/issue`, { method: 'POST', token }),
  recordPayment: (token: string, body: Record<string, unknown>) =>
    request<Row>('/finance/payments', { method: 'POST', token, body }),
  revenue: (token: string) => request<Row>('/finance/revenue', { token }),

  // --- inventory ---
  stock: (token: string) => request<Row[]>('/inventory/stock', { token }),
  createStockItem: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/inventory/stock', { method: 'POST', token, body }),
  suppliers: (token: string) => request<Row[]>('/inventory/suppliers', { token }),
  createSupplier: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/inventory/suppliers', { method: 'POST', token, body }),
  lowStock: (token: string) => request<Row[]>('/inventory/low-stock', { token }),
  expiring: (token: string) => request<Row[]>('/inventory/expiring', { token }),

  // --- donors ---
  donors: (token: string) => request<Row[]>('/donors', { token }),
  createDonor: (token: string, body: Record<string, unknown>) =>
    request<Row>('/donors', { method: 'POST', token, body }),
  donations: (token: string, donorId?: string) =>
    request<Row[]>(`/donors/donations${donorId ? `?donorId=${donorId}` : ''}`, { token }),
  addDonation: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/donors/donations', { method: 'POST', token, body }),

  // --- counseling ---
  createSession: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/counseling/sessions', { method: 'POST', token, body }),
  sessions: (token: string, patientId: string) =>
    request<Row[]>(`/counseling/patients/${patientId}/sessions`, { token }),

  // --- HR ---
  staff: (token: string) => request<Row[]>('/hr/staff', { token }),
  createProfile: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/hr/staff', { method: 'POST', token, body }),
  attendance: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/hr/attendance', { method: 'POST', token, body }),
  leave: (token: string, body: Record<string, unknown>) =>
    request<Row>('/hr/leave', { method: 'POST', token, body }),
  setLeaveStatus: (token: string, id: string, status: string) =>
    request<Row>(`/hr/leave/${id}`, { method: 'PATCH', token, body: { status } }),

  // --- imaging ---
  createStudy: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/imaging/studies', { method: 'POST', token, body }),
  studies: (token: string, patientId: string) =>
    request<Row[]>(`/imaging/patients/${patientId}/studies`, { token }),
  getStudy: (token: string, id: string) => request<Row>(`/imaging/studies/${id}`, { token }),
  verifyStudy: (token: string, id: string) =>
    request<Row>(`/imaging/studies/${id}/verify`, { method: 'POST', token }),

  // --- nursing ---
  recordVitals: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/nursing/vitals', { method: 'POST', token, body }),
  vitals: (token: string, patientId: string) =>
    request<Row[]>(`/nursing/patients/${patientId}/vitals`, { token }),
  createNote: (token: string, body: Record<string, unknown>) =>
    request<{ id: string }>('/nursing/notes', { method: 'POST', token, body }),
  nursingNotes: (token: string, patientId: string) =>
    request<Row[]>(`/nursing/patients/${patientId}/notes`, { token }),

  // --- reports ---
  reports: (token: string) => request<{ reports: { id: string; formats: string[] }[] }>('/reports', { token }),
  downloadReport: async (token: string, kind: string, format: string): Promise<void> => {
    const base = await resolveApiBase();
    const res = await fetch(`${base}/reports/${kind}.${format}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new ApiError(`Export failed (${res.status})`, res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}.${format === 'xlsx' ? 'xls' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // --- settings catalogues ---
  services: (token: string) => request<ServiceItem[]>('/settings/services', { token }),
  tests: (token: string) => request<TestItem[]>('/settings/tests', { token }),
  medications: (token: string) => request<MedicationItem[]>('/settings/medications', { token })
};
