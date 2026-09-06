import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/auth.guard';
import { ClinicalService } from './clinical.service';
import { CreateRecordSchema, UpdateRecordSchema, SignRecordSchema, ConsultationSchema, DiagnosisSchema, PrescriptionSchema, InvestigationSchema, AlertSchema } from './clinical.schemas';

@ApiTags('clinical')
@Controller('clinical')
@UseGuards(AuthGuard)
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}

  @Post('records')
  @RequirePermissions('clinical_record:create')
  createRecord(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(CreateRecordSchema)) body: Parameters<ClinicalService['createRecord']>[1]) {
    return this.clinical.createRecord(user.userId, body);
  }

  @Patch('records/:id')
  @RequirePermissions('clinical_record:update')
  updateRecord(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodValidationPipe(UpdateRecordSchema)) body: { body: Record<string, unknown>; reason?: string }) {
    return this.clinical.updateRecord(user.userId, user.permissions, id, body);
  }

  @Post('records/:id/sign')
  @RequirePermissions('clinical_record:sign')
  sign(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodValidationPipe(SignRecordSchema)) _body: { confirm: boolean }) {
    return this.clinical.signRecord(id, user.userId);
  }

  @Post('records/:id/verify')
  @RequirePermissions('clinical_record:verify')
  verify(@Param('id') id: string) {
    return this.clinical.verify(id);
  }

  @Post('records/:id/release')
  @RequirePermissions('clinical_record:release')
  release(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.clinical.release(id, user.userId);
  }

  @Get('patients/:patientId/records')
  @RequirePermissions('clinical_record:view')
  listRecords(@Param('patientId') patientId: string) {
    return this.clinical.listForPatient(patientId);
  }

  @Get('records/:id/versions')
  @RequirePermissions('clinical_record:view')
  versions(@Param('id') id: string) {
    return this.clinical.versions(id);
  }

  @Post('consultations')
  @RequirePermissions('consultation:create')
  createConsultation(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(ConsultationSchema)) body: Parameters<ClinicalService['createConsultation']>[1]) {
    return this.clinical.createConsultation(user.userId, body);
  }

  @Post('consultations/:id/sign')
  @RequirePermissions('consultation:sign')
  signConsultation(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.clinical.signConsultation(id, user.userId);
  }

  @Get('patients/:patientId/consultations')
  @RequirePermissions('consultation:view')
  consultations(@Param('patientId') patientId: string) {
    return this.clinical.consultations(patientId);
  }

  @Post('diagnoses')
  @RequirePermissions('clinical_record:create')
  addDiagnosis(@Body(new ZodValidationPipe(DiagnosisSchema)) body: { patientId: string; code?: string | null; description: string; onsetDate?: string | null }) {
    return this.clinical.addDiagnosis(body);
  }

  @Get('patients/:patientId/diagnoses')
  @RequirePermissions('clinical_record:view')
  diagnoses(@Param('patientId') patientId: string) {
    return this.clinical.diagnoses(patientId);
  }

  @Post('prescriptions')
  @RequirePermissions('prescription:create')
  addPrescription(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(PrescriptionSchema)) body: Parameters<ClinicalService['addPrescription']>[1]) {
    return this.clinical.addPrescription(user.userId, body);
  }

  @Get('patients/:patientId/prescriptions')
  @RequirePermissions('prescription:view')
  prescriptions(@Param('patientId') patientId: string) {
    return this.clinical.prescriptions(patientId);
  }

  @Post('investigations')
  @RequirePermissions('investigation:create')
  orderInvestigation(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(InvestigationSchema)) body: { patientId: string; testCatalogId: string; cycleId?: string | null; clinicalNote?: string | null }) {
    return this.clinical.orderInvestigation(user.userId, body);
  }

  @Get('patients/:patientId/investigations')
  @RequirePermissions('investigation:view')
  investigations(@Param('patientId') patientId: string) {
    return this.clinical.investigations(patientId);
  }

  @Post('alerts')
  @RequirePermissions('clinical_record:create')
  addAlert(@Body(new ZodValidationPipe(AlertSchema)) body: { patientId: string; severity: string; message: string }) {
    return this.clinical.addAlert(body);
  }

  @Get('patients/:patientId/alerts')
  @RequirePermissions('clinical_record:view')
  alerts(@Param('patientId') patientId: string) {
    return this.clinical.alerts(patientId);
  }
}
