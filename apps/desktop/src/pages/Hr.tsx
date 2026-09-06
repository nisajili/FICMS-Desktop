import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Row } from '../api';
import { useAuth } from '../auth';
import { cell } from '../kit';

export function HrPage() {
  const { token } = useAuth();
  const [staff, setStaff] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [userId, setUserId] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setStaff(await api.staff(token));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff.');
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
      await api.createProfile(token, {
        userId,
        employeeNumber: employeeNumber || null,
        department: department || null,
        jobTitle: jobTitle || null
      });
      setUserId('');
      setEmployeeNumber('');
      setDepartment('');
      setJobTitle('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create profile.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Human resources</h1>
        <p className="muted">Staff profiles linked to user accounts; attendance and leave are recorded via the API.</p>
      </header>
      {error && <div className="error">{error}</div>}

      <div className="grid">
        <section className="panel">
          <h2>Create staff profile</h2>
          <form onSubmit={submit} className="stack">
            <label>
              User ID
              <input value={userId} onChange={(e) => setUserId(e.target.value)} required />
            </label>
            <div className="row">
              <label>
                Employee number
                <input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} maxLength={32} />
              </label>
              <label>
                Department
                <input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={80} />
              </label>
            </div>
            <label>
              Job title
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={80} />
            </label>
            {formError && <div className="error">{formError}</div>}
            <button className="btn btn-primary" type="submit">
              Create profile
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Staff</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Employee #</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={cell(s, 'id')}>
                  <td>{cell(s, 'fullName', 'full_name')}</td>
                  <td className="mono">{cell(s, 'username')}</td>
                  <td>{cell(s, 'employee_number', 'employeeNumber')}</td>
                  <td>{cell(s, 'department')}</td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No staff profiles.
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
