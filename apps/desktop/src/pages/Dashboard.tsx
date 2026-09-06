import { useEffect, useState } from 'react';
import { api, type HealthResponse, type PatientPage, type ServiceItem } from '../api';
import { useAuth } from '../auth';

interface Counts {
  patients: number;
  services: number;
}

export function DashboardPage() {
  const { token, user } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [h, patients, services] = await Promise.all([
          api.health(),
          api.patients(token, 1, 1),
          api.services(token)
        ] as [Promise<HealthResponse>, Promise<PatientPage>, Promise<ServiceItem[]>]);
        setHealth(h);
        setCounts({ patients: patients.total, services: services.length });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load dashboard.');
      }
    })();
  }, [token]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Dashboard</h1>
        <p className="muted">
          Welcome, {user?.fullName ?? '—'}. The backend is connected and responding.
        </p>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="cards">
        <div className="card">
          <div className="card-label">System status</div>
          <div className="card-value">{health ? health.status : '…'}</div>
          <div className="card-sub">provider: {health?.provider ?? '—'}</div>
        </div>
        <div className="card">
          <div className="card-label">Registered patients</div>
          <div className="card-value">{counts?.patients ?? '…'}</div>
        </div>
        <div className="card">
          <div className="card-label">Active service catalogue</div>
          <div className="card-value">{counts?.services ?? '…'}</div>
        </div>
      </div>

      <section className="panel">
        <h2>Your access</h2>
        <ul className="kv">
          <li>
            <span>Username</span>
            <span>{user?.username}</span>
          </li>
          <li>
            <span>Roles</span>
            <span>{(user?.roles ?? []).join(', ') || '—'}</span>
          </li>
          <li>
            <span>Two-factor</span>
            <span>{user?.twoFactorEnabled ? 'Enabled' : 'Not set'}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
