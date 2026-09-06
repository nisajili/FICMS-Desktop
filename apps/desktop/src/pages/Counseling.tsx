import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Row } from '../api';
import { useAuth } from '../auth';
import { cell } from '../kit';

export function CounselingPage() {
  const { token } = useAuth();
  const [patientId, setPatientId] = useState('');
  const [kind, setKind] = useState('PRE_TREATMENT');
  const [notes, setNotes] = useState('');
  const [restricted, setRestricted] = useState(false);
  const [sessions, setSessions] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !patientId) return;
    try {
      setSessions(await api.sessions(token, patientId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions.');
    }
  }, [token, patientId]);

  useEffect(() => {
    if (patientId) void load();
  }, [load, patientId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.createSession(token, { patientId, kind, notes: notes || null, restricted });
      setNotes('');
      setRestricted(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record session.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Counseling</h1>
        <p className="muted">Confidential sessions with restricted, encrypted notes.</p>
      </header>
      {error && <div className="error">{error}</div>}

      <div className="grid">
        <section className="panel">
          <h2>Record session</h2>
          <form onSubmit={submit} className="stack">
            <label>
              Patient ID
              <input value={patientId} onChange={(e) => setPatientId(e.target.value)} required />
            </label>
            <label>
              Kind
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {['PRE_TREATMENT', 'GENETIC', 'DONOR', 'GRIEF', 'COUPLES', 'OTHER'].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} />
              Restricted (visible only to counselors/administrators)
            </label>
            {formError && <div className="error">{formError}</div>}
            <button className="btn btn-primary" type="submit">
              Record session
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Sessions</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Restricted</th>
                <th>Counselor</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={cell(s, 'id')}>
                  <td>{cell(s, 'kind')}</td>
                  <td>{s.restricted ? 'Yes' : 'No'}</td>
                  <td className="mono">{cell(s, 'counselorId', 'counselor_id')}</td>
                  <td>{cell(s, 'notes')}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No sessions for this patient.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
