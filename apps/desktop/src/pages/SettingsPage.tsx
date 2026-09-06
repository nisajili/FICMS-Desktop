import { useEffect, useState } from 'react';
import { api, type Branding, type ServiceItem } from '../api';
import { useAuth } from '../auth';

export function SettingsPage() {
  const { token, mode } = useAuth();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [b, s] = await Promise.all([api.branding(), api.services(token)]);
        setBranding(b);
        setServices(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load settings.');
      }
    })();
  }, [token]);

  const price = (s: ServiceItem) => {
    const minor = s.priceMinor ?? s.price_minor ?? 0;
    return `${(minor / 100).toFixed(2)} ${branding?.currency ?? ''}`.trim();
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Clinic settings</h1>
        <p className="muted">
          All branding and locale values are configured per clinic — nothing is hard-coded.{' '}
          <span className="mono">{mode} mode</span>
        </p>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h2>Branding</h2>
        <ul className="kv">
          <li>
            <span>Clinic name</span>
            <span>{branding?.clinicName ?? '—'}</span>
          </li>
          <li>
            <span>Country</span>
            <span>{branding?.country ?? '—'}</span>
          </li>
          <li>
            <span>Currency</span>
            <span>{branding?.currency ?? '—'}</span>
          </li>
          <li>
            <span>Timezone</span>
            <span>{branding?.timezone ?? '—'}</span>
          </li>
          <li>
            <span>Languages</span>
            <span>{(branding?.languages ?? []).join(', ') || '—'}</span>
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>Service catalogue</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.code}</td>
                <td>{s.name}</td>
                <td>{s.category ?? '—'}</td>
                <td>{price(s)}</td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No services configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
