import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/decorators';
import { RequirePermissions } from '../../common/permissions.guard';
import type { RequestUser } from '../../common/auth.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CounselingService } from './counseling.service';
import { CreateSessionSchema } from './counseling.schemas';

@ApiTags('counseling')
@Controller('counseling')
@UseGuards(AuthGuard)
export class CounselingController {
  constructor(private readonly counseling: CounselingService) {}

  @Post('sessions')
  @RequirePermissions('counseling:create')
  @ApiOperation({ summary: 'Record a counseling session (notes encrypted)' })
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(CreateSessionSchema)) body: Parameters<CounselingService['create']>[1]) {
    return this.counseling.create(user.userId, body);
  }

  @Get('patients/:patientId/sessions')
  @RequirePermissions('counseling:view')
  list(@CurrentUser() user: RequestUser, @Param('patientId') patientId: string) {
    const canViewRestricted = user.permissions.includes('*') || user.permissions.includes('counseling:sign');
    return this.counseling.listForPatient(patientId, canViewRestricted);
  }
}
