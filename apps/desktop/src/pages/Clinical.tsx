import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Patient, type Row, type TestItem } from '../api';
import { useAuth } from '../auth';
import { cell, fmtDate } from '../kit';

type Tab = 'records' | 'consultations' | 'diagnoses' | 'prescriptions' | 'investigations';

export function ClinicalPage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [tab, setTab] = useState<Tab>('records');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // form fields
  const [kind, setKind] = useState('SOAP');
  const [body, setBody] = useState('');
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [testCatalogId, setTestCatalogId] = useState('');
  const [tests, setTests] = useState<TestItem[]>([]);

  const loadPatients = useCallback(async () => {
    if (!token) return;
    const page = await api.patients(token, 1, 100);
    setPatients(page.items);
    setTests(await api.tests(token));
  }, [token]);

  useEffect(() => {
    void loadPatients().catch((err: Error) => setError(err.message));
  }, [loadPatients]);

  const loadTab = useCallback(async () => {
    if (!token || !patientId) return;
    try {
      switch (tab) {
        case 'records':
          setRows(await api.records(token, patientId));
          break;
        case 'consultations':
          setRows(await api.consultations(token, patientId));
          break;
        case 'diagnoses':
          setRows(await api.diagnoses(token, patientId));
          break;
        case 'prescriptions':
          setRows(await api.prescriptions(token, patientId));
          break;
        case 'investigations':
          setRows(await api.investigations(token, patientId));
          break;
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load clinical records.');
    }
  }, [token, patientId, tab]);

  useEffect(() => {
    if (patientId) void loadTab();
  }, [loadTab, patientId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      if (tab === 'records') await api.createRecord(token, { patientId, kind, body: { note: body || undefined } });
      if (tab === 'consultations') {
        await api.createConsultation(token, { patientId, subjective: subjective || null, objective: objective || null, assessment: assessment || null, plan: plan || null });
        setSubjective('');
        setObjective('');
        setAssessment('');
        setPlan('');
      }
      if (tab === 'diagnoses') {
        await api.createDiagnosis(token, { patientId, code: code || null, description });
        setCode('');
        setDescription('');
      }
      if (tab === 'prescriptions') {
        await api.createPrescription(token, { patientId, medication, dose: dose || null, frequency: frequency || null });
        setMedication('');
        setDose('');
        setFrequency('');
      }
      if (tab === 'investigations') {
        await api.createInvestigation(token, { patientId, testCatalogId });
        setTestCatalogId('');
      }
      setBody('');
      await loadTab();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const columns: Record<Tab, string[]> = {
    records: ['Kind', 'Status', 'Author', 'Created'],
    consultations: ['Assessment', 'Plan', 'Author', 'Created'],
    diagnoses: ['Code', 'Description', 'Onset', 'Created'],
    prescriptions: ['Medication', 'Dose', 'Frequency', 'Status'],
    investigations: ['Test', 'Status', 'Ordered by', 'Created']
  };

  const renderCell = (r: Row, col: string): string => {
    switch (col) {
      case 'Kind':
        return cell(r, 'kind');
      case 'Status':
        return cell(r, 'status');
      case 'Author':
        return cell(r, 'authorId', 'author_id');
      case 'Assessment':
        return cell(r, 'assessment');
      case 'Plan':
        return cell(r, 'plan');
      case 'Code':
        return cell(r, 'code');
      case 'Description':
        return cell(r, 'description');
      case 'Onset':
        return fmtDate(r.onsetDate ?? r.onset_date);
      case 'Medication':
        return cell(r, 'medication');
      case 'Dose':
        return cell(r, 'dose');
      case 'Frequency':
        return cell(r, 'frequency');
      case 'Test':
        return cell(r, 'testCatalogId', 'test_catalog_id');
      case 'Ordered by':
        return cell(r, 'orderedById', 'ordered_by_id');
      default:
        return fmtDate(r.createdAt ?? r.created_at);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Clinical (EMR)</h1>
        <p className="muted">Records, consultations, diagnoses, prescriptions and investigations.</p>
      </header>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ gridTemplateColumns: '1fr' }}>
        <label>
          Patient
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Select…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.mrn} — {p.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="tabs" style={{ display: 'flex', gap: 8 }}>
        {(['records', 'consultations', 'diagnoses', 'prescriptions', 'investigations'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'btn btn-primary' : 'btn'} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <div className="grid">
        <section className="panel">
          <h2>New {tab.slice(0, -1)}</h2>
          <form onSubmit={submit} className="stack">
            {tab === 'records' && (
              <>
                <label>
                  Kind
                  <input value={kind} onChange={(e) => setKind(e.target.value)} required maxLength={40} />
                </label>
                <label>
                  Note
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }} />
                </label>
              </>
            )}
            {tab === 'consultations' && (
              <>
                <label>
                  Subjective
                  <textarea value={subjective} onChange={(e) => setSubjective(e.target.value)} rows={2} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }} />
                </label>
                <label>
                  Objective
                  <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }} />
                </label>
                <label>
                  Assessment
                  <textarea value={assessment} onChange={(e) => setAssessment(e.target.value)} rows={2} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }} />
                </label>
                <label>
                  Plan
                  <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 8 }} />
                </label>
              </>
            )}
            {tab === 'diagnoses' && (
              <>
                <label>
                  Code (e.g. ICD-10)
                  <input value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
                <label>
                  Description
                  <input value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={500} />
                </label>
              </>
            )}
            {tab === 'prescriptions' && (
              <>
                <label>
                  Medication
                  <input value={medication} onChange={(e) => setMedication(e.target.value)} required maxLength={160} />
                </label>
                <div className="row">
                  <label>
                    Dose
                    <input value={dose} onChange={(e) => setDose(e.target.value)} />
                  </label>
                  <label>
                    Frequency
                    <input value={frequency} onChange={(e) => setFrequency(e.target.value)} />
                  </label>
                </div>
              </>
            )}
            {tab === 'investigations' && (
              <label>
                Test
                <select value={testCatalogId} onChange={(e) => setTestCatalogId(e.target.value)} required>
                  <option value="">Select…</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code ?? ''} — {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {formError && <div className="error">{formError}</div>}
            <button className="btn btn-primary" type="submit" disabled={!patientId}>
              Save
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>{tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
          <table className="table">
            <thead>
              <tr>
                {columns[tab].map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={cell(r, 'id')}>
                  {columns[tab].map((c) => (
                    <td key={c}>{renderCell(r, c)}</td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns[tab].length} className="muted">
                    Nothing recorded.
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
