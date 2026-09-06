import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Patient, type Row, type ServiceItem } from '../api';
import { useAuth } from '../auth';
import { cell, fmtMoney } from '../kit';

export function FinancePage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [revenue, setRevenue] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPriceMinor, setUnitPriceMinor] = useState('');
  const [payInvoiceId, setPayInvoiceId] = useState('');
  const [payAmountMinor, setPayAmountMinor] = useState('');
  const [payMethod, setPayMethod] = useState('MOBILE_MONEY');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [inv, rev, svc] = await Promise.all([api.invoices(token), api.revenue(token), api.services(token)]);
      setInvoices(inv);
      setRevenue(rev);
      setServices(svc);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load finance data.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    void api.patients(token, 1, 100).then((p) => setPatients(p.items)).catch(() => undefined);
  }, [token]);

  const createInvoice = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      const linePrice = Number(unitPriceMinor || (services.find((s) => s.id === serviceId)?.price_minor ?? 0));
      await api.createInvoice(token, {
        patientId,
        currency: 'TZS',
        lines: [{ serviceId, description: 'Consultation', quantity: Number(quantity), unitPriceMinor: linePrice, discountMinor: 0, taxRate: 18 }]
      });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create invoice.');
    }
  };

  const issue = async (id: string) => {
    try {
      await api.issueInvoice(token!, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue invoice.');
    }
  };

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.recordPayment(token, { invoiceId: payInvoiceId, amountMinor: Number(payAmountMinor), method: payMethod, idempotencyKey: `ui-${Date.now()}` });
      setPayInvoiceId('');
      setPayAmountMinor('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Payment failed.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Finance &amp; billing</h1>
        <p className="muted">Invoices, payments (idempotent) and revenue.</p>
      </header>
      {error && <div className="error">{error}</div>}
      {formError && <div className="error">{formError}</div>}

      <div className="cards">
        <div className="card">
          <div className="card-label">Billed</div>
          <div className="card-value">{fmtMoney(revenue?.billedTotalMinor ?? 0, 'TZS')}</div>
        </div>
        <div className="card">
          <div className="card-label">Collected</div>
          <div className="card-value">{fmtMoney(revenue?.collectedTotalMinor ?? 0, 'TZS')}</div>
        </div>
        <div className="card">
          <div className="card-label">Invoices</div>
          <div className="card-value">{invoices.length}</div>
        </div>
      </div>

      <div className="grid">
        <section className="panel">
          <h2>Create invoice</h2>
          <form onSubmit={createInvoice} className="stack">
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
              Service
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
                <option value="">Select…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({fmtMoney(s.price_minor ?? 0, 'TZS')})
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <label>
                Quantity
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={1} />
              </label>
              <label>
                Unit price (minor)
                <input type="number" value={unitPriceMinor} onChange={(e) => setUnitPriceMinor(e.target.value)} placeholder="auto" />
              </label>
            </div>
            <button className="btn btn-primary" type="submit">
              Create invoice
            </button>
          </form>

          <h2 style={{ marginTop: 16 }}>Record payment</h2>
          <form onSubmit={pay} className="stack">
            <label>
              Invoice ID
              <input value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)} required />
            </label>
            <div className="row">
              <label>
                Amount (minor)
                <input type="number" value={payAmountMinor} onChange={(e) => setPayAmountMinor(e.target.value)} required />
              </label>
              <label>
                Method
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'INSURANCE'].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="btn" type="submit">
              Record payment
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Invoices</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Patient</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={cell(i, 'id')}>
                  <td className="mono">{cell(i, 'number')}</td>
                  <td className="mono">{cell(i, 'patientId', 'patient_id')}</td>
                  <td>{fmtMoney(i.grand_total_minor ?? 0, 'TZS')}</td>
                  <td>{cell(i, 'status')}</td>
                  <td>
                    {cell(i, 'status') === 'DRAFT' && (
                      <button className="btn" onClick={() => void issue(cell(i, 'id'))}>
                        Issue
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No invoices.
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
