import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/auth.guard';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stock')
  @RequirePermissions('inventory:view')
  stock() {
    return this.inventory.listStock();
  }

  @Post('stock')
  @RequirePermissions('inventory:create')
  createStock(@Body(new ZodValidationPipe(z.object({
    medicationId: z.string(), batchNumber: z.string(), quantityOnHand: z.number().int().min(0), expiryDate: z.string().optional().nullable(), location: z.string().optional().nullable(), minStock: z.number().int().optional()
  }))) body: Parameters<InventoryService['createStockItem']>[0]) {
    return this.inventory.createStockItem(body);
  }

  @Post('movements')
  @RequirePermissions('inventory:create')
  movement(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({
    stockItemId: z.string(), type: z.enum(['RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'DISPOSAL']), quantity: z.number().int().positive(), reference: z.string().optional().nullable(), reason: z.string().optional().nullable()
  }))) body: { stockItemId: string; type: string; quantity: number; reference?: string | null; reason?: string | null }) {
    return this.inventory.movement(body, user.userId);
  }

  @Post('adjust')
  @RequirePermissions('inventory:update')
  adjust(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({
    stockItemId: z.string(), delta: z.number().int(), reason: z.string().optional().nullable()
  }))) body: { stockItemId: string; delta: number; reason?: string | null }) {
    return this.inventory.adjust(body, user.userId);
  }

  @Post('issue-fefo')
  @RequirePermissions('inventory:update')
  issueFefo(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({ medicationId: z.string(), quantity: z.number().int().positive() }))) body: { medicationId: string; quantity: number }) {
    return this.inventory.issueFefo(body.medicationId, body.quantity, user.userId);
  }

  @Get('ledger')
  @RequirePermissions('inventory:view')
  ledger() {
    return this.inventory.ledger();
  }

  @Get('expiring')
  @RequirePermissions('inventory:view')
  expiring(@Query('days') days?: string) {
    return this.inventory.expiring(days ? Number(days) : 90);
  }

  @Get('low-stock')
  @RequirePermissions('inventory:view')
  lowStock() {
    return this.inventory.lowStock();
  }

  @Post('dispense')
  @RequirePermissions('pharmacy:create')
  dispense(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({
    prescriptionId: z.string(), stockItemId: z.string(), quantity: z.number().int().positive(), partial: z.boolean().optional(), verifiedById: z.string().optional().nullable()
  }))) body: Parameters<InventoryService['dispense']>[0]) {
    return this.inventory.dispense(body, user.userId);
  }

  @Get('suppliers')
  @RequirePermissions('inventory:view')
  suppliers() {
    return this.inventory.suppliers();
  }

  @Post('suppliers')
  @RequirePermissions('inventory:create')
  createSupplier(@Body(new ZodValidationPipe(z.object({ name: z.string(), contact: z.string().optional().nullable() }))) body: { name: string; contact?: string | null }) {
    return this.inventory.createSupplier(body.name, body.contact);
  }

  @Post('purchase-orders')
  @RequirePermissions('inventory:create')
  purchaseOrder(@Body(new ZodValidationPipe(z.object({
    supplierId: z.string(), lines: z.array(z.object({ medicationId: z.string(), quantity: z.number().int().positive(), unitCostMinor: z.number().int().min(0) }))
  }))) body: Parameters<InventoryService['createPurchaseOrder']>[0]) {
    return this.inventory.createPurchaseOrder(body);
  }
}
