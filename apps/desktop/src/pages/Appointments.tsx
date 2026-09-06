import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Patient, type Row } from '../api';
import { useAuth } from '../auth';
import { cell, fmtDate } from '../kit';

export function AppointmentsPage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const loadPatients = useCallback(async () => {
    if (!token) return;
    try {
      const page = await api.patients(token, 1, 100);
      setPatients(page.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load patients.');
    }
  }, [token]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const loadAppointments = useCallback(async () => {
    if (!token || !patientId) return;
    try {
      setAppointments(await api.appointments(token, patientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load appointments.');
    }
  }, [token, patientId]);

  useEffect(() => {
    if (patientId) void loadAppointments();
  }, [loadAppointments, patientId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.scheduleAppointment(token, { patientId, title, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() });
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      await loadAppointments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not schedule appointment.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Reception &amp; appointments</h1>
        <p className="muted">Front-desk scheduling and check-in.</p>
      </header>
      {error && <div className="error">{error}</div>}

      <div className="grid">
        <section className="panel">
          <h2>Schedule appointment</h2>
          <form onSubmit={submit} className="stack">
            <label>
              Patient
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
                <option value="">Select…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.mrn} — {p.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
            </label>
            <div className="row">
              <label>
                Start
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
              </label>
              <label>
                End
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
              </label>
            </div>
            {formError && <div className="error">{formError}</div>}
            <button className="btn btn-primary" type="submit">
              Schedule
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Upcoming</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Starts</th>
                <th>Status</th>
                <th>Queue token</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={cell(a, 'id')}>
                  <td>{cell(a, 'title')}</td>
                  <td>{fmtDate(a.starts_at ?? a.startsAt)}</td>
                  <td>{cell(a, 'status')}</td>
                  <td className="mono">{cell(a, 'queue_token', 'queueToken')}</td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No appointments for the selected patient.
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
