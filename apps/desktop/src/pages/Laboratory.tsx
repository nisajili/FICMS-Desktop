import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Patient, type Row } from '../api';
import { useAuth } from '../auth';
import { cell, fmtDate } from '../kit';

export function LaboratoryPage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [results, setResults] = useState<Row[]>([]);
  const [qc, setQc] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // sample form
  const [collectedAt, setCollectedAt] = useState('');
  const [sampleId, setSampleId] = useState('');
  const [concentration, setConcentration] = useState('');
  const [totalMotility, setTotalMotility] = useState('');

  // qc form
  const [equipment, setEquipment] = useState('');
  const [qcKind, setQcKind] = useState('CALIBRATION');
  const [qcResult, setQcResult] = useState('PASS');

  const loadPatients = useCallback(async () => {
    if (!token) return;
    const page = await api.patients(token, 1, 100);
    setPatients(page.items);
  }, [token]);

  useEffect(() => {
    void loadPatients().catch((err: Error) => setError(err.message));
  }, [loadPatients]);

  const loadQc = useCallback(async () => {
    if (!token) return;
    setQc(await api.qcList(token));
  }, [token]);

  useEffect(() => {
    void loadQc().catch((err: Error) => setError(err.message));
  }, [loadQc]);

  const loadResults = useCallback(async () => {
    if (!token || !patientId) return;
    try {
      setResults(await api.labResults(token, patientId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load results.');
    }
  }, [token, patientId]);

  useEffect(() => {
    if (patientId) void loadResults();
  }, [loadResults, patientId]);

  const createSample = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !patientId) return;
    setFormError(null);
    try {
      const created = await api.createSample(token, { patientId, collectedAt: new Date(collectedAt || Date.now()).toISOString() });
      setSampleId(created.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create sample.');
    }
  };

  const addAnalysis = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.addAnalysis(token, {
        sampleId,
        concentration: concentration ? Number(concentration) : null,
        totalMotility: totalMotility ? Number(totalMotility) : null
      });
      setConcentration('');
      setTotalMotility('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add analysis.');
    }
  };

  const logQc = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.logQc(token, { equipment, kind: qcKind, result: qcResult });
      setEquipment('');
      await loadQc();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not log QC.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Laboratory</h1>
        <p className="muted">Andrology/embryology sample analysis and general lab results.</p>
      </header>
      {error && <div className="error">{error}</div>}
      {formError && <div className="error">{formError}</div>}

      <div className="grid">
        <section className="panel">
          <h2>Sample analysis</h2>
          <form onSubmit={createSample} className="stack">
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
              Collected at
              <input type="datetime-local" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} />
            </label>
            <button className="btn" type="submit">
              Create sample
            </button>
            {sampleId && <p className="fineprint">Sample created: {sampleId}</p>}
          </form>

          <form onSubmit={addAnalysis} className="stack" style={{ marginTop: 12 }}>
            <label>
              Sample ID
              <input value={sampleId} onChange={(e) => setSampleId(e.target.value)} required />
            </label>
            <div className="row">
              <label>
                Concentration (M/ml)
                <input type="number" value={concentration} onChange={(e) => setConcentration(e.target.value)} />
              </label>
              <label>
                Total motility (%)
                <input type="number" value={totalMotility} onChange={(e) => setTotalMotility(e.target.value)} />
              </label>
            </div>
            <button className="btn btn-primary" type="submit">
              Add analysis
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Results</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Value</th>
                <th>Status</th>
                <th>Entered</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={cell(r, 'id')}>
                  <td>{cell(r, 'testId', 'test_id')}</td>
                  <td>{cell(r, 'value') || cell(r, 'valueText', 'value_text')}</td>
                  <td>{cell(r, 'status')}</td>
                  <td>{fmtDate(r.createdAt ?? r.created_at)}</td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h2>Quality control</h2>
        <form onSubmit={logQc} className="stack">
          <div className="row">
            <label>
              Equipment
              <input value={equipment} onChange={(e) => setEquipment(e.target.value)} required />
            </label>
            <label>
              Kind
              <select value={qcKind} onChange={(e) => setQcKind(e.target.value)}>
                {['CALIBRATION', 'QC_SAMPLE', 'MAINTENANCE'].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Result
              <select value={qcResult} onChange={(e) => setQcResult(e.target.value)}>
                {['PASS', 'FAIL', 'PENDING'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            Log QC entry
          </button>
        </form>
        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Kind</th>
              <th>Result</th>
              <th>Logged</th>
            </tr>
          </thead>
          <tbody>
            {qc.map((q) => (
              <tr key={cell(q, 'id')}>
                <td>{cell(q, 'equipment')}</td>
                <td>{cell(q, 'kind')}</td>
                <td>{cell(q, 'result')}</td>
                <td>{fmtDate(q.createdAt ?? q.created_at)}</td>
              </tr>
            ))}
            {qc.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No QC entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
