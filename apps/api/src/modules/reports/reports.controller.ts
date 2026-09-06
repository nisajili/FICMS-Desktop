import { BadRequestException, Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ReportsService, type ReportKind } from './reports.service';

const KINDS: ReportKind[] = ['patients', 'appointments', 'invoices', 'stock', 'cryo', 'lab-results', 'revenue'];

@ApiTags('reports')
@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':kind.csv')
  @RequirePermissions('report:export')
  async csv(@Param('kind') kind: ReportKind, @Res() res: Response): Promise<void> {
    if (!KINDS.includes(kind)) throw new BadRequestException('Unknown report type.');
    const data = await this.reports.build(kind);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${kind}.csv"`);
    res.send(await this.reports.toCsv(data));
  }

  @Get(':kind.xlsx')
  @RequirePermissions('report:export')
  async excel(@Param('kind') kind: ReportKind, @Res() res: Response): Promise<void> {
    if (!KINDS.includes(kind)) throw new BadRequestException('Unknown report type.');
    const data = await this.reports.build(kind);
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${kind}.xls"`);
    res.send(await this.reports.toExcelXml(data));
  }

  @Get(':kind.pdf')
  @RequirePermissions('report:export')
  async pdf(@Param('kind') kind: ReportKind, @Res() res: Response): Promise<void> {
    if (!KINDS.includes(kind)) throw new BadRequestException('Unknown report type.');
    const data = await this.reports.build(kind);
    const buffer = await buildPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${kind}.pdf"`);
    res.send(buffer);
  }

  @Get()
  @RequirePermissions('report:view')
  list() {
    return { reports: KINDS.map((k) => ({ id: k, formats: ['csv', 'xlsx', 'pdf'] })) };
  }
}

async function buildPdf(data: { title: string; headers: string[]; rows: (string | number)[][] }): Promise<Buffer> {
  // Lazy-load pdfkit so the dependency is only required for PDF exports.
  const { default: PDFDocument } = await import('pdfkit');
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));
  doc.fontSize(16).text(data.title);
  doc.moveDown();
  doc.fontSize(9).text(data.headers.join('  |  '));
  doc.fontSize(9).text('-'.repeat(data.headers.join('  |  ').length + 4));
  for (const row of data.rows.slice(0, 200)) {
    doc.fontSize(8).text(row.map((v) => String(v).slice(0, 30)).join('  |  '));
  }
  doc.end();
  await done;
  return Buffer.concat(chunks);
}
