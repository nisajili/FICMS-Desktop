import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { PatientsService } from './patients.service';
import { RegisterPatientSchema, UpdatePatientSchema, ScheduleAppointmentSchema, MergeSchema, PartnerSchema } from './patients.schemas';

@ApiTags('patients')
@Controller('patients')
@UseGuards(AuthGuard)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @RequirePermissions('patient:view')
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: string) {
    return this.patients.list(Number(page) || 1, Number(pageSize) || 20, status);
  }

  @Get('search')
  @RequirePermissions('patient:view')
  search(@Query('q') q: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.patients.search(q ?? '', Number(page) || 1, Number(pageSize) || 20);
  }

  @Post()
  @RequirePermissions('patient:create')
  @ApiOperation({ summary: 'Register a new patient (duplicate detection included)' })
  register(@Body(new ZodValidationPipe(RegisterPatientSchema)) body: Parameters<PatientsService['register']>[0]) {
    return this.patients.register(body);
  }

  @Post('duplicates')
  @RequirePermissions('patient:view')
  duplicates(@Body() body: { firstName: string; lastName: string; dateOfBirth?: string | null; primaryPhone?: string | null }) {
    return this.patients.duplicates(body);
  }

  @Post('merge')
  @RequirePermissions('patient:update')
  merge(@Body(new ZodValidationPipe(MergeSchema)) body: { sourceId: string; targetId: string }) {
    return this.patients.merge(body.sourceId, body.targetId);
  }

  @Post(':id/partners')
  @RequirePermissions('patient:update')
  addPartner(@Param('id') id: string, @Body(new ZodValidationPipe(PartnerSchema)) body: { partnerId: string; relationship?: string }) {
    return this.patients.addPartner(id, body.partnerId, body.relationship ?? 'PARTNER');
  }

  @Get(':id')
  @RequirePermissions('patient:view')
  get(@Param('id') id: string) {
    return this.patients.get(id);
  }

  @Patch(':id')
  @RequirePermissions('patient:update')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdatePatientSchema)) body: Parameters<PatientsService['update']>[1]) {
    return this.patients.update(id, body);
  }

  // --- Appointments -------------------------------------------------------

  @Get(':id/appointments')
  @RequirePermissions('appointment:view')
  appointments(@Param('id') id: string) {
    return this.patients.appointments({ patientId: id });
  }

  @Post('appointments')
  @RequirePermissions('appointment:create')
  schedule(@Body(new ZodValidationPipe(ScheduleAppointmentSchema)) body: Parameters<PatientsService['schedule']>[0]) {
    return this.patients.schedule(body);
  }

  @Post('appointments/:id/check-in')
  @RequirePermissions('appointment:update')
  checkIn(@Param('id') id: string) {
    return this.patients.checkIn(id);
  }

  @Post('appointments/:id/check-out')
  @RequirePermissions('appointment:update')
  checkOut(@Param('id') id: string) {
    return this.patients.checkOut(id);
  }

  @Post('appointments/:id/cancel')
  @RequirePermissions('appointment:cancel')
  cancel(@Param('id') id: string) {
    return this.patients.cancelAppointment(id);
  }
}
