import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { SyncService } from './sync.service';

const SyncOpSchema = z.object({
  entityKind: z.enum(['patient', 'appointment', 'consultation', 'payment', 'stock_movement', 'laboratory']),
  entityId: z.string(),
  operationType: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string()
});

@ApiTags('sync')
@Controller('sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  @RequirePermissions('sync:update')
  push(@Body(new ZodValidationPipe(z.object({ clientId: z.string(), operations: z.array(SyncOpSchema).max(200) }))) body: {
    clientId: string;
    operations: Parameters<SyncService['push']>[1];
  }) {
    return this.sync.push(body.clientId, body.operations);
  }

  @Get('conflicts')
  @RequirePermissions('sync:update')
  conflicts() {
    return this.sync.conflicts();
  }

  @Post('conflicts/:id/resolve')
  @RequirePermissions('sync:update')
  resolve(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ resolution: z.enum(['RESOLVED_LOCAL', 'RESOLVED_REMOTE']) }))) body: { resolution: 'RESOLVED_LOCAL' | 'RESOLVED_REMOTE' }) {
    return this.sync.resolveConflict(id, body.resolution);
  }

  @Get('status')
  @RequirePermissions('sync:update')
  status() {
    return this.sync.status();
  }
}
