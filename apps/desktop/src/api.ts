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
  health: () => request<HealthResponse>('/health'),
  branding: () => request<Branding>('/settings/branding'),
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password } }),
  me: (token: string) => request<PublicUser>('/auth/me', { token }),
  logout: (token: string) => request<void>('/auth/logout', { method: 'POST', token }),
  patients: (token: string, page = 1, pageSize = 25) =>
    request<PatientPage>(`/patients?page=${page}&pageSize=${pageSize}`, { token }),
  registerPatient: (token: string, body: Record<string, unknown>) =>
    request<Patient & { duplicateCandidates: unknown[] }>('/patients', { method: 'POST', token, body }),
  services: (token: string) => request<ServiceItem[]>('/settings/services', { token })
};
