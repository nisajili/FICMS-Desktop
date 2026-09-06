import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

interface ReportDef {
  id: string;
  formats: string[];
}

const LABELS: Record<string, string> = {
  patients: 'Patient registry',
  appointments: 'Appointments',
  invoices: 'Invoices',
  stock: 'Stock',
  cryo: 'Cryobank inventory',
  'lab-results': 'Laboratory results',
  revenue: 'Revenue'
};

export function ReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<ReportDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.reports(token);
      setReports(data.reports);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (id: string, format: string) => {
    if (!token) return;
    setBusy(`${id}.${format}`);
    try {
      await api.downloadReport(token, id, format);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Reports</h1>
        <p className="muted">Export as CSV, Excel (XML) or PDF.</p>
      </header>
      {error && <div className="error">{error}</div>}

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Report</th>
              <th>Formats</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{LABELS[r.id] ?? r.id}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {r.formats.map((f) => (
                      <button key={f} className="btn" disabled={busy === `${r.id}.${f}`} onClick={() => void download(r.id, f)}>
                        {busy === `${r.id}.${f}` ? '…' : f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={2} className="muted">
                  No reports available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
