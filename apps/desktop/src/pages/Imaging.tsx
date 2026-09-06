import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Row } from '../api';
import { useAuth } from '../auth';
import { cell, fmtDate } from '../kit';

export function ImagingPage() {
  const { token } = useAuth();
  const [patientId, setPatientId] = useState('');
  const [type, setType] = useState('ULTRASOUND');
  const [title, setTitle] = useState('');
  const [findings, setFindings] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [studies, setStudies] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !patientId) return;
    try {
      setStudies(await api.studies(token, patientId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load studies.');
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
      await api.createStudy(token, {
        patientId,
        type,
        title,
        findings: findings || null,
        conclusion: conclusion || null
      });
      setTitle('');
      setFindings('');
      setConclusion('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create study.');
    }
  };

  const verify = async (id: string) => {
    if (!token) return;
    try {
      await api.verifyStudy(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Imaging &amp; ultrasound</h1>
        <p className="muted">Findings and conclusions are encrypted at rest.</p>
      </header>
      {error && <div className="error">{error}</div>}

      <div className="grid">
        <section className="panel">
          <h2>New study</h2>
          <form onSubmit={submit} className="stack">
            <label>
              Patient ID
              <input value={patientId} onChange={(e) => setPatientId(e.target.value)} required />
            </label>
            <div className="row">
              <label>
                Type
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {['ULTRASOUND', 'SALINE_SONOGRAM', 'DOPPLER', 'FOLLICLE_SCAN', 'OTHER'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
              </label>
            </div>
            <label>
              Findings
              <textarea
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                rows={3}
                style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }}
              />
            </label>
            <label>
              Conclusion
              <textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                rows={2}
                style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }}
              />
            </label>
            {formError && <div className="error">{formError}</div>}
            <button className="btn btn-primary" type="submit">
              Save study
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Studies</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s) => (
                <tr key={cell(s, 'id')}>
                  <td>{cell(s, 'title')}</td>
                  <td>{cell(s, 'type')}</td>
                  <td>{cell(s, 'status')}</td>
                  <td>{fmtDate(s.studyDate ?? s.study_date)}</td>
                  <td>
                    {cell(s, 'status') !== 'VERIFIED' && (
                      <button className="btn" onClick={() => void verify(cell(s, 'id'))}>
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {studies.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No studies for this patient.
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
