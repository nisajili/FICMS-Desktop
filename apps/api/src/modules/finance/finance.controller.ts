import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/auth.guard';
import { FinanceService } from './finance.service';

const InvoiceLineSchema = z.object({
  serviceId: z.string(),
  description: z.string(),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().min(0),
  discountMinor: z.number().int().min(0).default(0),
  taxRate: z.number().min(0).default(0)
});

@ApiTags('finance')
@Controller('finance')
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('invoices')
  @RequirePermissions('finance:view')
  list(@Query('patientId') patientId?: string, @Query('status') status?: string) {
    return this.finance.listInvoices({ patientId, status });
  }

  @Post('invoices')
  @RequirePermissions('finance:create')
  createInvoice(@Body(new ZodValidationPipe(z.object({
    patientId: z.string(), currency: z.string().optional(), dueDate: z.string().optional().nullable(), lines: z.array(InvoiceLineSchema).min(1)
  }))) body: Parameters<FinanceService['createInvoice']>[0]) {
    return this.finance.createInvoice(body);
  }

  @Get('invoices/:id')
  @RequirePermissions('finance:view')
  get(@Param('id') id: string) {
    return this.finance.getInvoice(id);
  }

  @Post('invoices/:id/issue')
  @RequirePermissions('finance:update')
  issue(@Param('id') id: string) {
    return this.finance.issue(id);
  }

  @Post('invoices/:id/void')
  @RequirePermissions('finance:cancel')
  voidInvoice(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ reason: z.string().min(1) }))) body: { reason: string }) {
    return this.finance.voidInvoice(id, body.reason);
  }

  @Post('invoices/:id/installments')
  @RequirePermissions('finance:create')
  installment(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ dueDate: z.string(), amountMinor: z.number().int().positive() }))) body: { dueDate: string; amountMinor: number }) {
    return this.finance.addInstallment(id, body.dueDate, body.amountMinor);
  }

  @Post('payments')
  @RequirePermissions('finance:create')
  pay(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({
    invoiceId: z.string(), amountMinor: z.number().int().positive(), method: z.enum(['CASH', 'BANK', 'CARD', 'MOBILE_MONEY', 'INSURANCE', 'OTHER']), reference: z.string().optional().nullable(), idempotencyKey: z.string().optional().nullable()
  }))) body: Parameters<FinanceService['recordPayment']>[0]) {
    return this.finance.recordPayment(body, user.userId);
  }

  @Post('payments/:id/void')
  @RequirePermissions('finance:refund')
  voidPayment(@Param('id') id: string) {
    return this.finance.voidPayment(id);
  }

  @Post('credit-notes')
  @RequirePermissions('finance:refund')
  creditNote(@Body(new ZodValidationPipe(z.object({ invoiceId: z.string(), amountMinor: z.number().int().positive(), reason: z.string().min(1) }))) body: { invoiceId: string; amountMinor: number; reason: string }) {
    return this.finance.creditNote(body);
  }

  @Post('shifts/open')
  @RequirePermissions('finance:create')
  openShift(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({ openingFloatMinor: z.number().int().min(0) }))) body: { openingFloatMinor: number }) {
    return this.finance.openShift(user.userId, body.openingFloatMinor);
  }

  @Post('shifts/:id/close')
  @RequirePermissions('finance:update')
  closeShift(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ closingCashMinor: z.number().int().min(0) }))) body: { closingCashMinor: number }) {
    return this.finance.closeShift(id, body.closingCashMinor);
  }

  @Get('revenue')
  @RequirePermissions('report:view')
  revenue() {
    return this.finance.revenue();
  }
}
