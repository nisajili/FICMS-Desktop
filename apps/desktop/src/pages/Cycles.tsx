import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Patient, type Row } from '../api';
import { useAuth } from '../auth';
import { cell, fmtDate } from '../kit';

export function CyclesPage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [cycles, setCycles] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [embryos, setEmbryos] = useState<Row[]>([]);
  const [pgt, setPgt] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [type, setType] = useState('IVF');
  const [startDate, setStartDate] = useState('');

  // workflow form
  const [maturity, setMaturity] = useState('MII');
  const [oocyteCount, setOocyteCount] = useState('');
  const [method, setMethod] = useState('ICSI');
  const [eggsInseminated, setEggsInseminated] = useState('');
  const [embryoCode, setEmbryoCode] = useState('');
  const [embryoDay, setEmbryoDay] = useState('5');
  const [embryoStage, setEmbryoStage] = useState('BLASTOCYST');
  const [embryoGrade, setEmbryoGrade] = useState('');
  const [pgtEmbryoId, setPgtEmbryoId] = useState('');
  const [pgtResult, setPgtResult] = useState('');

  const loadPatients = useCallback(async () => {
    if (!token) return;
    const page = await api.patients(token, 1, 100);
    setPatients(page.items);
  }, [token]);

  useEffect(() => {
    void loadPatients().catch((err: Error) => setError(err.message));
  }, [loadPatients]);

  const loadCycles = useCallback(async () => {
    if (!token || !patientId) return;
    try {
      setCycles(await api.cycles(token, patientId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load cycles.');
    }
  }, [token, patientId]);

  useEffect(() => {
    if (patientId) void loadCycles();
  }, [loadCycles, patientId]);

  const loadSelected = useCallback(async () => {
    if (!token || !selected) return;
    try {
      const [e, p] = await Promise.all([api.embryos(token, selected), api.pgt(token, selected)]);
      setEmbryos(e);
      setPgt(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load cycle details.');
    }
  }, [token, selected]);

  useEffect(() => {
    if (selected) void loadSelected();
  }, [loadSelected, selected]);

  const run = async (fn: (t: string) => Promise<unknown>, clear?: () => void) => {
    if (!token || !selected) return;
    setFormError(null);
    try {
      await fn(token);
      clear?.();
      await loadSelected();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Operation failed.');
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !patientId) return;
    setFormError(null);
    try {
      await api.createCycle(token, { patientId, type, startDate: startDate || undefined });
      setStartDate('');
      await loadCycles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create cycle.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>ART cycles</h1>
        <p className="muted">IVF / ICSI / IUI cycle management with monitoring and embryology.</p>
      </header>
      {error && <div className="error">{error}</div>}
      {formError && <div className="error">{formError}</div>}

      <section className="panel">
        <h2>New cycle</h2>
        <form onSubmit={create} className="stack">
          <div className="row">
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
              Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {['IVF', 'ICSI', 'IUI', 'FET', 'IVF_ICSI', 'OTHER'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            Create cycle
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Cycles</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Type</th>
              <th>Status</th>
              <th>Start</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={cell(c, 'id')} style={{ cursor: 'pointer', background: selected === cell(c, 'id') ? 'var(--panel-2)' : undefined }} onClick={() => setSelected(cell(c, 'id'))}>
                <td className="mono">{cell(c, 'cycleNumber', 'cycle_number')}</td>
                <td>{cell(c, 'type')}</td>
                <td>{cell(c, 'status')}</td>
                <td>{fmtDate(c.startDate ?? c.start_date)}</td>
              </tr>
            ))}
            {cycles.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No cycles for this patient.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <div className="grid">
          <section className="panel">
            <h2>Embryology workflow</h2>
            <div className="stack">
              <div className="row">
                <label>
                  Oocyte maturity
                  <select value={maturity} onChange={(e) => setMaturity(e.target.value)}>
                    {['MII', 'MI', 'GV', 'DEGENERATE'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Count
                  <input type="number" value={oocyteCount} onChange={(e) => setOocyteCount(e.target.value)} />
                </label>
              </div>
              <button className="btn" onClick={() => void run((t) => api.addOocytes(t, selected, { maturity, count: Number(oocyteCount) }))}>
                Record oocytes
              </button>

              <div className="row">
                <label>
                  Fertilization method
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    {['IVF', 'ICSI', 'IMSI'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Eggs inseminated
                  <input type="number" value={eggsInseminated} onChange={(e) => setEggsInseminated(e.target.value)} />
                </label>
              </div>
              <button className="btn" onClick={() => void run((t) => api.recordFertilization(t, selected, { method, eggsInseminated: Number(eggsInseminated), twoPnCount: Number(eggsInseminated) }))}>
                Record fertilization
              </button>

              <div className="row">
                <label>
                  Embryo code
                  <input value={embryoCode} onChange={(e) => setEmbryoCode(e.target.value)} />
                </label>
                <label>
                  Day
                  <input type="number" value={embryoDay} onChange={(e) => setEmbryoDay(e.target.value)} />
                </label>
              </div>
              <div className="row">
                <label>
                  Stage
                  <input value={embryoStage} onChange={(e) => setEmbryoStage(e.target.value)} />
                </label>
                <label>
                  Grade
                  <input value={embryoGrade} onChange={(e) => setEmbryoGrade(e.target.value)} />
                </label>
              </div>
              <button
                className="btn"
                onClick={() => void run((t) => api.addEmbryo(t, selected, { code: embryoCode, day: Number(embryoDay), stage: embryoStage, grade: embryoGrade || undefined, quality: 'GOOD' }), () => setEmbryoCode(''))}
              >
                Add embryo
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Embryos &amp; PGT</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Day</th>
                  <th>Stage</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {embryos.map((e) => (
                  <tr key={cell(e, 'id')}>
                    <td className="mono">{cell(e, 'code')}</td>
                    <td>{cell(e, 'day')}</td>
                    <td>{cell(e, 'stage')}</td>
                    <td>{cell(e, 'grade')}</td>
                  </tr>
                ))}
                {embryos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No embryos recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <h2 style={{ marginTop: 16 }}>Record PGT</h2>
            <div className="row">
              <label>
                Embryo
                <select value={pgtEmbryoId} onChange={(e) => setPgtEmbryoId(e.target.value)}>
                  <option value="">Select…</option>
                  {embryos.map((e) => (
                    <option key={cell(e, 'id')} value={cell(e, 'id')}>
                      {cell(e, 'code')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Result
                <input value={pgtResult} onChange={(e) => setPgtResult(e.target.value)} placeholder="Euploid / Aneuploid…" />
              </label>
            </div>
            <button
              className="btn"
              style={{ marginTop: 8 }}
              onClick={() => void run((t) => api.addPgt(t, selected, { embryoId: pgtEmbryoId, testType: 'PGT-A', result: pgtResult || null, euploid: pgtResult === 'Euploid' }), () => setPgtResult(''))}
            >
              Record PGT
            </button>

            <h2 style={{ marginTop: 16 }}>PGT results</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Embryo</th>
                  <th>Test</th>
                  <th>Result</th>
                  <th>Euploid</th>
                </tr>
              </thead>
              <tbody>
                {pgt.map((p) => (
                  <tr key={cell(p, 'id')}>
                    <td className="mono">{cell(p, 'embryoId', 'embryo_id')}</td>
                    <td>{cell(p, 'testType', 'test_type')}</td>
                    <td>{cell(p, 'result')}</td>
                    <td>{p.euploid ? 'Yes' : p.euploid === null || p.euploid === undefined ? '—' : 'No'}</td>
                  </tr>
                ))}
                {pgt.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No PGT results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
