import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type MedicationItem, type Row } from '../api';
import { useAuth } from '../auth';
import { cell, fmtDate } from '../kit';

export function InventoryPage() {
  const { token } = useAuth();
  const [stock, setStock] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [lowStock, setLowStock] = useState<Row[]>([]);
  const [expiring, setExpiring] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [medicationId, setMedicationId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantityOnHand, setQuantityOnHand] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, sp, m, low, exp] = await Promise.all([
        api.stock(token),
        api.suppliers(token),
        api.medications(token),
        api.lowStock(token),
        api.expiring(token)
      ]);
      setStock(s);
      setSuppliers(sp);
      setMedications(m);
      setLowStock(low);
      setExpiring(exp);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load inventory.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const createStock = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.createStockItem(token, {
        medicationId,
        batchNumber,
        quantityOnHand: Number(quantityOnHand),
        expiryDate: expiryDate || null
      });
      setBatchNumber('');
      setQuantityOnHand('');
      setExpiryDate('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add stock.');
    }
  };

  const createSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await api.createSupplier(token, { name: supplierName, contact: supplierContact || null });
      setSupplierName('');
      setSupplierContact('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add supplier.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Pharmacy &amp; inventory</h1>
        <p className="muted">Stock, suppliers, low-stock and expiry surveillance.</p>
      </header>
      {error && <div className="error">{error}</div>}
      {formError && <div className="error">{formError}</div>}

      <div className="grid">
        <section className="panel">
          <h2>Add stock</h2>
          <form onSubmit={createStock} className="stack">
            <label>
              Medication
              <select value={medicationId} onChange={(e) => setMedicationId(e.target.value)} required>
                <option value="">Select…</option>
                {medications.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code ?? ''} — {m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <label>
                Batch
                <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} required />
              </label>
              <label>
                Quantity
                <input type="number" value={quantityOnHand} onChange={(e) => setQuantityOnHand(e.target.value)} required min={0} />
              </label>
            </div>
            <label>
              Expiry
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </label>
            <button className="btn btn-primary" type="submit">
              Add stock
            </button>
          </form>

          <h2 style={{ marginTop: 16 }}>Add supplier</h2>
          <form onSubmit={createSupplier} className="stack">
            <label>
              Name
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
            </label>
            <label>
              Contact
              <input value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} />
            </label>
            <button className="btn" type="submit">
              Add supplier
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Stock</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Medication</th>
                <th>Batch</th>
                <th>Qty</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={cell(s, 'id')}>
                  <td className="mono">{cell(s, 'medicationId', 'medication_id')}</td>
                  <td>{cell(s, 'batchNumber', 'batch_number')}</td>
                  <td>{cell(s, 'quantityOnHand', 'quantity_on_hand')}</td>
                  <td>{fmtDate(s.expiryDate ?? s.expiry_date)}</td>
                </tr>
              ))}
              {stock.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No stock items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h2 style={{ marginTop: 16 }}>Suppliers</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={cell(s, 'id')}>
                  <td>{cell(s, 'name')}</td>
                  <td>{cell(s, 'contact')}</td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted">
                    No suppliers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid">
        <section className="panel">
          <h2>Low stock</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Medication</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((s) => (
                <tr key={cell(s, 'id')}>
                  <td className="mono">{cell(s, 'medicationId', 'medication_id')}</td>
                  <td>{cell(s, 'quantityOnHand', 'quantity_on_hand')}</td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted">
                    Nothing below minimum.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Expiring soon</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((s) => (
                <tr key={cell(s, 'id')}>
                  <td>{cell(s, 'batchNumber', 'batch_number')}</td>
                  <td>{fmtDate(s.expiryDate ?? s.expiry_date)}</td>
                </tr>
              ))}
              {expiring.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted">
                    Nothing expiring soon.
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
