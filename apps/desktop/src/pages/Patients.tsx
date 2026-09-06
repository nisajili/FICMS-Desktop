import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Patient, type PatientPage } from '../api';
import { useAuth } from '../auth';

const SEX_OPTIONS = ['FEMALE', 'MALE', 'INTERSEX', 'UNSPECIFIED'];

export function PatientsPage() {
  const { token } = useAuth();
  const [page, setPage] = useState<PatientPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New-patient form state.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState('FEMALE');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setPage(await api.patients(token, 1, 25));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load patients.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setCreating(true);
    setFormError(null);
    try {
      const created = await api.registerPatient(token, {
        firstName,
        lastName,
        sex,
        dateOfBirth: dateOfBirth || null
      });
      const candidates = created.duplicateCandidates as { mrn: string; fullName: string }[];
      if (candidates.length) {
        setFormError(
          `Registered as ${created.mrn}. Possible duplicates: ${candidates.map((c) => `${c.fullName} (${c.mrn})`).join(', ')}`
        );
      }
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Patients</h1>
        <p className="muted">{page?.total ?? 0} registered patient(s).</p>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        <section className="panel">
          <h2>Register patient</h2>
          <form onSubmit={submit} className="stack">
            <div className="row">
              <label>
                First name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} />
              </label>
              <label>
                Last name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={80} />
              </label>
            </div>
            <div className="row">
              <label>
                Sex
                <select value={sex} onChange={(e) => setSex(e.target.value)}>
                  {SEX_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date of birth
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </label>
            </div>
            {formError && <div className="error">{formError}</div>}
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Registering…' : 'Register'}
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Registry</h2>
          <table className="table">
            <thead>
              <tr>
                <th>MRN</th>
                <th>Name</th>
                <th>Sex</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(page?.items ?? []).map((p: Patient) => (
                <tr key={p.id}>
                  <td className="mono">{p.mrn}</td>
                  <td>{p.fullName}</td>
                  <td>{p.sex}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
              {(page?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No patients yet.
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
