import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Row } from '../api';
import { useAuth } from '../auth';
import { cell, fmtDate } from '../kit';

export function NursingPage() {
  const { token } = useAuth();
  const [patientId, setPatientId] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [spo2, setSpo2] = useState('');

  const [noteKind, setNoteKind] = useState('ASSESSMENT');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');

  const [vitals, setVitals] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !patientId) return;
    try {
      const [v, n] = await Promise.all([api.vitals(token, patientId), api.nursingNotes(token, patientId)]);
      setVitals(v);
      setNotes(n);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load nursing records.');
    }
  }, [token, patientId]);

  useEffect(() => {
    if (patientId) void load();
  }, [load, patientId]);

  const submitVitals = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.recordVitals(token, {
        patientId,
        systolic: systolic ? Number(systolic) : null,
        diastolic: diastolic ? Number(diastolic) : null,
        heartRate: heartRate ? Number(heartRate) : null,
        spo2: spo2 ? Number(spo2) : null
      });
      setSystolic('');
      setDiastolic('');
      setHeartRate('');
      setSpo2('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record vitals.');
    }
  };

  const submitNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.createNote(token, { patientId, kind: noteKind, title: noteTitle || null, notes: noteText || null });
      setNoteTitle('');
      setNoteText('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record note.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Nursing</h1>
        <p className="muted">Vitals and nursing notes; notes are encrypted at rest.</p>
      </header>
      {error && <div className="error">{error}</div>}

      <div className="grid">
        <section className="panel">
          <h2>Record vitals</h2>
          <form onSubmit={submitVitals} className="stack">
            <label>
              Patient ID
              <input value={patientId} onChange={(e) => setPatientId(e.target.value)} required />
            </label>
            <div className="row">
              <label>
                Systolic
                <input type="number" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
              </label>
              <label>
                Diastolic
                <input type="number" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
              </label>
            </div>
            <div className="row">
              <label>
                Heart rate
                <input type="number" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
              </label>
              <label>
                SpO₂
                <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
              </label>
            </div>
            {formError && <div className="error">{formError}</div>}
            <button className="btn btn-primary" type="submit">
              Save vitals
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Vitals history</h2>
          <table className="table">
            <thead>
              <tr>
                <th>BP</th>
                <th>HR</th>
                <th>SpO₂</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {vitals.map((v) => (
                <tr key={cell(v, 'id')}>
                  <td>
                    {cell(v, 'systolic')}/{cell(v, 'diastolic')}
                  </td>
                  <td>{cell(v, 'heartRate', 'heart_rate')}</td>
                  <td>{cell(v, 'spo2')}</td>
                  <td>{fmtDate(v.recordedAt ?? v.recorded_at)}</td>
                </tr>
              ))}
              {vitals.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No vitals recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h2>Nursing note</h2>
        <form onSubmit={submitNote} className="stack">
          <div className="row">
            <label>
              Kind
              <select value={noteKind} onChange={(e) => setNoteKind(e.target.value)}>
                {['ASSESSMENT', 'MEDICATION', 'EDUCATION', 'CARE_PLAN', 'HANDOVER', 'OTHER'].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} maxLength={160} />
            </label>
          </div>
          <label>
            Notes
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }}
            />
          </label>
          <button className="btn btn-primary" type="submit">
            Record note
          </button>
        </form>

        <h2 style={{ marginTop: 16 }}>Notes</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Title</th>
              <th>Restricted</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <tr key={cell(n, 'id')}>
                <td>{cell(n, 'kind')}</td>
                <td>{cell(n, 'title')}</td>
                <td>{n.restricted ? 'Yes' : 'No'}</td>
                <td>{fmtDate(n.createdAt ?? n.created_at)}</td>
              </tr>
            ))}
            {notes.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No notes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
