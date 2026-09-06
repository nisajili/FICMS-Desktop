import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/auth.guard';
import { CryobankService } from './cryobank.service';

@ApiTags('cryobank')
@Controller('cryobank')
@UseGuards(AuthGuard)
export class CryobankController {
  constructor(private readonly cryo: CryobankService) {}

  @Get('hierarchy')
  @RequirePermissions('cryobank:view')
  hierarchy() {
    return this.cryo.hierarchy();
  }

  @Get('tanks')
  @RequirePermissions('cryobank:view')
  tanks() {
    return this.cryo.tanks();
  }

  @Post('facilities')
  @RequirePermissions('cryobank:create')
  createFacility(@Body(new ZodValidationPipe(z.object({ name: z.string() }))) body: { name: string }) {
    return this.cryo.createFacility(body.name);
  }

  @Post('rooms')
  @RequirePermissions('cryobank:create')
  createRoom(@Body(new ZodValidationPipe(z.object({ facilityId: z.string(), name: z.string() }))) body: { facilityId: string; name: string }) {
    return this.cryo.createRoom(body.facilityId, body.name);
  }

  @Post('tanks')
  @RequirePermissions('cryobank:create')
  createTank(@Body(new ZodValidationPipe(z.object({ roomId: z.string(), name: z.string(), capacitySlots: z.number().int().optional() }))) body: { roomId: string; name: string; capacitySlots?: number }) {
    return this.cryo.createTank(body.roomId, body.name, body.capacitySlots);
  }

  @Post('canisters')
  @RequirePermissions('cryobank:create')
  createCanister(@Body(new ZodValidationPipe(z.object({ tankId: z.string(), name: z.string() }))) body: { tankId: string; name: string }) {
    return this.cryo.createCanister(body.tankId, body.name);
  }

  @Post('canes')
  @RequirePermissions('cryobank:create')
  createCane(@Body(new ZodValidationPipe(z.object({ canisterId: z.string(), name: z.string() }))) body: { canisterId: string; name: string }) {
    return this.cryo.createCane(body.canisterId, body.name);
  }

  @Post('goblets')
  @RequirePermissions('cryobank:create')
  createGoblet(@Body(new ZodValidationPipe(z.object({ caneId: z.string(), name: z.string() }))) body: { caneId: string; name: string }) {
    return this.cryo.createGoblet(body.caneId, body.name);
  }

  @Post('racks')
  @RequirePermissions('cryobank:create')
  createRack(@Body(new ZodValidationPipe(z.object({ gobletId: z.string(), name: z.string() }))) body: { gobletId: string; name: string }) {
    return this.cryo.createRack(body.gobletId, body.name);
  }

  @Post('positions')
  @RequirePermissions('cryobank:create')
  createPosition(@Body(new ZodValidationPipe(z.object({ rackId: z.string(), row: z.number().int().optional().nullable(), column: z.number().int().optional().nullable() }))) body: { rackId: string; row?: number | null; column?: number | null }) {
    return this.cryo.createPosition(body.rackId, body.row, body.column);
  }

  @Post('temperature')
  @RequirePermissions('cryobank:update')
  temperature(@Body(new ZodValidationPipe(z.object({ tankId: z.string(), temperatureK: z.number() }))) body: { tankId: string; temperatureK: number }) {
    return this.cryo.logTemperature(body.tankId, body.temperatureK);
  }

  @Get('items')
  @RequirePermissions('cryobank:view')
  items(@Query('patientId') patientId?: string, @Query('status') status?: string, @Query('entityType') entityType?: string) {
    return this.cryo.items({ patientId, status, entityType });
  }

  @Post('items')
  @RequirePermissions('cryobank:create')
  store(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({
    barcode: z.string(), entityType: z.enum(['SPERM', 'OOCYTE', 'EMBRYO', 'TISSUE']), patientId: z.string(), positionId: z.string(), freezeAt: z.string(), cycleId: z.string().optional().nullable(), embryoId: z.string().optional().nullable(), witnessUserId: z.string().optional().nullable()
  }))) body: Parameters<CryobankService['store']>[0]) {
    return this.cryo.store(body, user.userId);
  }

  @Post('items/:id/transfer')
  @RequirePermissions('cryobank:transfer')
  transfer(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodValidationPipe(z.object({
    toPositionId: z.string(), reason: z.string().optional().nullable(), witnessUserId: z.string().optional().nullable()
  }))) body: { toPositionId: string; reason?: string | null; witnessUserId?: string | null }) {
    return this.cryo.transfer({ itemId: id, ...body }, user.userId);
  }

  @Post('items/:id/release')
  @RequirePermissions('cryobank:release')
  release(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodValidationPipe(z.object({
    witnessUserId: z.string().optional().nullable(), reason: z.string().optional().nullable()
  }))) body: { witnessUserId?: string | null; reason?: string | null }) {
    return this.cryo.releaseOrDispose(id, 'RELEASED', user.userId, body.witnessUserId, body.reason);
  }

  @Post('items/:id/dispose')
  @RequirePermissions('cryobank:dispose')
  dispose(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodValidationPipe(z.object({
    witnessUserId: z.string().optional().nullable(), reason: z.string().optional().nullable()
  }))) body: { witnessUserId?: string | null; reason?: string | null }) {
    return this.cryo.releaseOrDispose(id, 'DISPOSED', user.userId, body.witnessUserId, body.reason);
  }

  @Post('agreements')
  @RequirePermissions('cryobank:create')
  agreement(@Body(new ZodValidationPipe(z.object({
    patientId: z.string(), itemIds: z.array(z.string()), signedAt: z.string(), expiresAt: z.string().optional().nullable()
  }))) body: Parameters<CryobankService['storageAgreement']>[0]) {
    return this.cryo.storageAgreement(body);
  }

  @Get('items/:id/witness')
  @RequirePermissions('cryobank:view')
  witness(@Param('id') id: string) {
    return this.cryo.witnessVerifications(id);
  }
}
