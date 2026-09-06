import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/decorators';
import { RequirePermissions } from '../../common/permissions.guard';
import type { RequestUser } from '../../common/auth.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { ImagingService } from './imaging.service';
import { CreateStudySchema, UpdateStudySchema } from './imaging.schemas';

@ApiTags('imaging')
@Controller('imaging')
@UseGuards(AuthGuard)
export class ImagingController {
  constructor(private readonly imaging: ImagingService) {}

  @Post('studies')
  @RequirePermissions('imaging:create')
  @ApiOperation({ summary: 'Create an imaging/ultrasound study (findings encrypted)' })
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(CreateStudySchema)) body: Parameters<ImagingService['create']>[1]) {
    return this.imaging.create(user.userId, body);
  }

  @Get('patients/:patientId/studies')
  @RequirePermissions('imaging:view')
  list(@Param('patientId') patientId: string) {
    return this.imaging.listForPatient(patientId);
  }

  @Get('studies/:id')
  @RequirePermissions('imaging:view')
  get(@Param('id') id: string) {
    return this.imaging.get(id);
  }

  @Patch('studies/:id')
  @RequirePermissions('imaging:update')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateStudySchema)) body: Parameters<ImagingService['update']>[1]) {
    return this.imaging.update(id, body);
  }

  @Post('studies/:id/verify')
  @RequirePermissions('imaging:verify')
  @ApiOperation({ summary: 'Verify an imaging study (records the verifying user)' })
  verify(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.imaging.verify(id, user.userId);
  }
}
