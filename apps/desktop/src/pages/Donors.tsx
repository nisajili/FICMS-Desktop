import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Row } from '../api';
import { useAuth } from '../auth';
import { cell } from '../kit';

export function DonorsPage() {
  const { token } = useAuth();
  const [donors, setDonors] = useState<Row[]>([]);
  const [donations, setDonations] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [donorCode, setDonorCode] = useState('');
  const [status, setStatus] = useState('SCREENING');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [d, dn] = await Promise.all([api.donors(token), api.donations(token)]);
      setDonors(d);
      setDonations(dn);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load donors.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.createDonor(token, { donorCode, status });
      setDonorCode('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Donor management</h1>
        <p className="muted">Donor identity is encrypted at rest and never shown in list views.</p>
      </header>
      {error && <div className="error">{error}</div>}

      <div className="grid">
        <section className="panel">
          <h2>Register donor</h2>
          <form onSubmit={submit} className="stack">
            <label>
              Donor code
              <input value={donorCode} onChange={(e) => setDonorCode(e.target.value)} required maxLength={32} />
            </label>
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {['SCREENING', 'ACTIVE', 'QUARANTINED', 'RELEASED', 'INACTIVE'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {formError && <div className="error">{formError}</div>}
            <button className="btn btn-primary" type="submit">
              Register
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Donors</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((d) => (
                <tr key={cell(d, 'id')}>
                  <td className="mono">{cell(d, 'donorCode')}</td>
                  <td>{cell(d, 'status')}</td>
                  <td>{cell(d, 'createdAt', 'created_at')}</td>
                </tr>
              ))}
              {donors.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No donors registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h2>Donations</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Sample barcode</th>
              <th>Donor</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((d) => (
              <tr key={cell(d, 'id')}>
                <td className="mono">{cell(d, 'sampleBarcode')}</td>
                <td>{cell(d, 'donorId')}</td>
                <td>{cell(d, 'createdAt', 'created_at')}</td>
              </tr>
            ))}
            {donations.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No donations recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
