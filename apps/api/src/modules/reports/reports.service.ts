import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';

export type ReportKind = 'patients' | 'appointments' | 'invoices' | 'stock' | 'cryo' | 'lab-results' | 'revenue';

interface ReportData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async build(kind: ReportKind): Promise<ReportData> {
    switch (kind) {
      case 'patients': {
        const { items } = await this.db.repos.patients.list(1, 10000);
        return {
          title: 'Patient Register',
          headers: ['MRN', 'First name', 'Last name', 'Sex', 'Date of birth', 'Status'],
          rows: items.map((p) => [p.mrn, p.firstName, p.lastName, p.sex, p.dateOfBirth ?? '', p.status])
        };
      }
      case 'appointments': {
        const rows = await this.db.repos.appointments.list({});
        return {
          title: 'Appointments',
          headers: ['Patient', 'Title', 'Starts', 'Ends', 'Status', 'Queue token'],
          rows: rows.map((r) => [String(r.patientMrn ?? ''), String(r.title), String(r.starts_at), String(r.ends_at), String(r.status), String(r.queue_token ?? '')])
        };
      }
      case 'invoices': {
        const rows = await this.db.repos.finance.listInvoices({});
        return {
          title: 'Invoices',
          headers: ['Number', 'Patient', 'Status', 'Grand total', 'Paid', 'Due'],
          rows: rows.map((r) => [
            String(r.number),
            String(r.patientMrn ?? ''),
            String(r.status),
            Number(r.grand_total_minor ?? 0) / 100,
            Number(r.paid_total_minor ?? 0) / 100,
            (Number(r.grand_total_minor ?? 0) - Number(r.paid_total_minor ?? 0)) / 100
          ])
        };
      }
      case 'stock': {
        const rows = await this.db.repos.inventory.listStock();
        return {
          title: 'Stock Report',
          headers: ['Medication', 'Batch', 'On hand', 'Expiry', 'Min stock'],
          rows: rows.map((r) => [String(r.medicationName), String(r.batch_number), Number(r.quantity_on_hand), String(r.expiry_date ?? ''), Number(r.min_stock)])
        };
      }
      case 'cryo': {
        const rows = await this.db.repos.cryo.items({});
        return {
          title: 'Cryostorage Report',
          headers: ['Barcode', 'Type', 'Patient', 'Position', 'Status'],
          rows: rows.map((r) => [String(r.barcode), String(r.entity_type), String(r.patientMrn ?? ''), String(r.positionPath), String(r.status)])
        };
      }
      case 'lab-results': {
        const rows = await this.db.repos.labResults.criticalUnsent();
        return {
          title: 'Critical Laboratory Results',
          headers: ['Test', 'Value', 'Flag', 'Status'],
          rows: rows.map((r) => [String(r.id), String(r.value ?? ''), String(r.flag ?? ''), String(r.status)])
        };
      }
      case 'revenue': {
        const rev = (await this.revenue()) as Record<string, number>;
        return {
          title: 'Revenue Summary',
          headers: ['Billed', 'Collected', 'Outstanding'],
          rows: [[rev.billedTotalMinor / 100, rev.collectedTotalMinor / 100, rev.outstandingMinor / 100]]
        };
      }
      default:
        throw new BadRequestException('Unknown report type.');
    }
  }

  async toCsv(data: ReportData): Promise<string> {
    const escape = (v: string | number): string => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [data.title, data.headers.map(escape).join(','), ...data.rows.map((r) => r.map(escape).join(','))];
    return lines.join('\n');
  }

  async toExcelXml(data: ReportData): Promise<string> {
    // SpreadsheetML 2003 — opens natively in Excel without any dependency.
    const cells = (row: (string | number)[]): string =>
      row.map((v) => `<Cell><Data ss:Type="${typeof v === 'number' ? 'Number' : 'String'}">${this.xml(String(v))}</Data></Cell>`).join('');
    const headerRow = `<Row>${cells(data.headers)}</Row>`;
    const bodyRows = data.rows.map((r) => `<Row>${cells(r)}</Row>`).join('');
    return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${this.xml(data.title)}"><Table>${headerRow}${bodyRows}</Table></Worksheet></Workbook>`;
  }

  private xml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private async revenue(): Promise<unknown> {
    const rows = await this.db.repos.finance.listInvoices({});
    let billed = 0;
    let collected = 0;
    for (const row of rows) {
      billed += Number(row.grand_total_minor ?? 0);
      collected += Number(row.paid_total_minor ?? 0);
    }
    return { billedTotalMinor: billed, collectedTotalMinor: collected, outstandingMinor: billed - collected };
  }
}
