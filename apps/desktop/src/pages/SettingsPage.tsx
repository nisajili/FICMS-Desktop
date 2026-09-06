import { useEffect, useState } from 'react';
import { api, type Branding, type ServiceItem } from '../api';
import { useAuth } from '../auth';
import type { FicmsUpdateStatus } from '../ficms-global';

export function SettingsPage() {
  const { token, mode } = useAuth();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updateEnabled, setUpdateEnabled] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<FicmsUpdateStatus>({ state: 'idle' });

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

  useEffect(() => {
    const updater = window.ficms?.updater;
    if (!updater) return;
    (async () => {
      setUpdateEnabled(await updater.enabled());
      setUpdateStatus(await updater.status());
    })();
    return updater.onStatus((status) => setUpdateStatus(status));
  }, []);

  const price = (s: ServiceItem) => {
    const minor = s.priceMinor ?? s.price_minor ?? 0;
    return `${(minor / 100).toFixed(2)} ${branding?.currency ?? ''}`.trim();
  };

  const updateLabel = (status: FicmsUpdateStatus): string => {
    switch (status.state) {
      case 'checking':
        return 'Checking for updates…';
      case 'available':
        return `Update ${status.version ?? ''} available`.trim();
      case 'not-available':
        return 'Up to date';
      case 'downloading':
        return `Downloading${status.percent !== undefined ? ` ${status.percent.toFixed(0)}%` : ''}…`;
      case 'downloaded':
        return 'Update ready — restart to install';
      case 'error':
        return `Update error: ${status.error ?? 'unknown'}`;
      default:
        return 'Idle';
    }
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
        <h2>Software updates</h2>
        {!window.ficms?.updater ? (
          <p className="muted">
            Update management is available in the installed desktop app. This browser preview cannot
            receive updates.
          </p>
        ) : !updateEnabled ? (
          <p className="muted">
            Automatic updates are not configured for this installation. An administrator can enable
            them by pointing the app at a self-hosted update server (see the operations guide).
          </p>
        ) : (
          <div className="update-row">
            <span className="mono">{updateLabel(updateStatus)}</span>
            <div className="update-actions">
              <button
                type="button"
                disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
                onClick={() => void window.ficms?.updater?.check()}
              >
                Check now
              </button>
              {updateStatus.state === 'available' && (
                <button type="button" onClick={() => void window.ficms?.updater?.download()}>
                  Download
                </button>
              )}
              {updateStatus.state === 'downloaded' && (
                <button type="button" onClick={() => void window.ficms?.updater?.install()}>
                  Restart &amp; install
                </button>
              )}
            </div>
          </div>
        )}
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
