import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/decorators';
import { RequirePermissions } from '../../common/permissions.guard';
import type { RequestUser } from '../../common/auth.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { NursingService } from './nursing.service';
import { CreateNoteSchema, VitalsSchema } from './nursing.schemas';

@ApiTags('nursing')
@Controller('nursing')
@UseGuards(AuthGuard)
export class NursingController {
  constructor(private readonly nursing: NursingService) {}

  @Post('vitals')
  @RequirePermissions('nursing:create')
  @ApiOperation({ summary: 'Record patient vitals' })
  recordVitals(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(VitalsSchema)) body: Parameters<NursingService['recordVitals']>[1]) {
    return this.nursing.recordVitals(user.userId, body);
  }

  @Get('patients/:patientId/vitals')
  @RequirePermissions('nursing:view')
  listVitals(@Param('patientId') patientId: string) {
    return this.nursing.listVitals(patientId);
  }

  @Post('notes')
  @RequirePermissions('nursing:create')
  @ApiOperation({ summary: 'Record a nursing note (notes encrypted)' })
  createNote(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(CreateNoteSchema)) body: Parameters<NursingService['createNote']>[1]) {
    return this.nursing.createNote(user.userId, body);
  }

  @Get('patients/:patientId/notes')
  @RequirePermissions('nursing:view')
  listNotes(@CurrentUser() user: RequestUser, @Param('patientId') patientId: string) {
    const canViewRestricted = user.permissions.includes('*') || user.permissions.includes('nursing:sign');
    return this.nursing.listNotes(patientId, canViewRestricted);
  }
}
