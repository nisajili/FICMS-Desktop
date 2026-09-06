import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CyclesService } from './cycles.service';
import { z } from 'zod';

const CycleSchema = z.object({
  patientId: z.string().min(1),
  partnerPatientId: z.string().optional().nullable(),
  type: z.enum(['IVF', 'ICSI', 'IUI', 'FET', 'OI', 'EGG_FREEZE', 'SPERM_FREEZE', 'DIAGNOSTIC']).optional(),
  protocolId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  clinicianId: z.string().optional().nullable(),
  embryologistId: z.string().optional().nullable()
});

@ApiTags('cycles')
@Controller('cycles')
@UseGuards(AuthGuard)
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Get()
  @RequirePermissions('clinical_record:view')
  list(@Query('patientId') patientId?: string) {
    return this.cycles.list(patientId);
  }

  @Post()
  @RequirePermissions('clinical_record:create')
  create(@Body(new ZodValidationPipe(CycleSchema)) body: Parameters<CyclesService['create']>[0]) {
    return this.cycles.create(body);
  }

  @Get(':id')
  @RequirePermissions('clinical_record:view')
  get(@Param('id') id: string) {
    return this.cycles.get(id);
  }

  @Patch(':id/status')
  @RequirePermissions('clinical_record:update')
  setStatus(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ status: z.string() }))) body: { status: string }) {
    return this.cycles.setStatus(id, body.status);
  }

  @Post(':id/complete')
  @RequirePermissions('clinical_record:update')
  complete(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ outcome: z.string(), summary: z.string().optional() }))) body: { outcome: string; summary?: string }) {
    return this.cycles.complete(id, body.outcome, body.summary);
  }

  @Post(':id/cancel')
  @RequirePermissions('clinical_record:update')
  cancel(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ summary: z.string().optional() }))) body: { summary?: string }) {
    return this.cycles.cancel(id, body.summary);
  }

  @Get(':id/timeline')
  @RequirePermissions('clinical_record:view')
  timeline(@Param('id') id: string) {
    return this.cycles.timeline(id);
  }

  @Post('timeline-events')
  @RequirePermissions('clinical_record:create')
  addTimelineEvent(@Body(new ZodValidationPipe(z.object({
    cycleId: z.string(), day: z.number().int().min(-30).max(60), title: z.string(), kind: z.string(), critical: z.boolean().optional(), notes: z.string().optional().nullable()
  }))) body: Parameters<CyclesService['addTimelineEvent']>[0]) {
    return this.cycles.addTimelineEvent(body);
  }

  @Post('timeline-events/:id/occurred')
  @RequirePermissions('clinical_record:update')
  markOccurred(@Param('id') id: string) {
    return this.cycles.markTimelineOccurred(id);
  }

  @Post(':id/follicles')
  @RequirePermissions('clinical_record:create')
  addFollicle(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({
    date: z.string(), ovary: z.enum(['LEFT', 'RIGHT']), count: z.number().int().min(0), sizesMm: z.array(z.number()), endometriumMm: z.number().optional().nullable(), notes: z.string().optional().nullable()
  }))) body: { date: string; ovary: string; count: number; sizesMm: number[]; endometriumMm?: number | null; notes?: string | null }) {
    return this.cycles.addFollicle({ cycleId: id, ...body });
  }

  @Get(':id/follicles')
  @RequirePermissions('clinical_record:view')
  follicles(@Param('id') id: string) {
    return this.cycles.follicleHistory(id);
  }

  @Post(':id/hormones')
  @RequirePermissions('laboratory:create')
  addHormone(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({
    date: z.string(), analyte: z.string(), value: z.number(), unit: z.string().optional().nullable(), referenceRange: z.string().optional().nullable()
  }))) body: { date: string; analyte: string; value: number; unit?: string | null; referenceRange?: string | null }) {
    return this.cycles.addHormone({ cycleId: id, ...body });
  }

  @Get(':id/hormones')
  @RequirePermissions('clinical_record:view')
  hormones(@Param('id') id: string) {
    return this.cycles.hormoneHistory(id);
  }

  @Post(':id/oocytes')
  @RequirePermissions('embryology:create')
  addOocytes(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({ maturity: z.string(), count: z.number().int().min(0) }))) body: { maturity: string; count: number }) {
    return this.cycles.addOocytes(id, body.maturity, body.count);
  }

  @Get(':id/oocytes')
  @RequirePermissions('embryology:view')
  oocytes(@Param('id') id: string) {
    return this.cycles.oocytes(id);
  }

  @Post(':id/fertilization')
  @RequirePermissions('embryology:create')
  fertilization(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({
    method: z.enum(['IVF', 'ICSI']), eggsInseminated: z.number().int().min(0), twoPnCount: z.number().int().optional().nullable(), abnormalFertilization: z.number().int().optional().nullable(), notes: z.string().optional().nullable()
  }))) body: { method: string; eggsInseminated: number; twoPnCount?: number | null; abnormalFertilization?: number | null; notes?: string | null }) {
    return this.cycles.recordFertilization({ cycleId: id, ...body });
  }

  @Post(':id/embryos')
  @RequirePermissions('embryology:create')
  createEmbryo(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({
    code: z.string(), day: z.number().int().min(1).max(6), stage: z.string(), grade: z.string().optional().nullable(), quality: z.enum(['GOOD', 'FAIR', 'POOR']).optional().nullable(), assistedHatching: z.boolean().optional(), biopsied: z.boolean().optional(), notes: z.string().optional().nullable()
  }))) body: Parameters<CyclesService['createEmbryo']>[0]) {
    return this.cycles.createEmbryo({ ...body, cycleId: id });
  }

  @Get(':id/embryos')
  @RequirePermissions('embryology:view')
  embryos(@Param('id') id: string) {
    return this.cycles.embryos(id);
  }

  @Patch('embryos/:embryoId')
  @RequirePermissions('embryology:update')
  updateEmbryo(@Param('embryoId') embryoId: string, @Body(new ZodValidationPipe(z.object({
    stage: z.string().optional(), grade: z.string().optional().nullable(), quality: z.enum(['GOOD', 'FAIR', 'POOR']).optional().nullable(), assistedHatching: z.boolean().optional(), biopsied: z.boolean().optional(), frozen: z.boolean().optional(), notes: z.string().optional().nullable()
  }))) body: Parameters<CyclesService['updateEmbryo']>[1]) {
    return this.cycles.updateEmbryo(embryoId, body);
  }

  @Post(':id/pgt')
  @RequirePermissions('embryology:create')
  addPgt(@Param('id') id: string, @Body(new ZodValidationPipe(z.object({
    embryoId: z.string(), testType: z.string().optional(), result: z.string().optional().nullable(), euploid: z.boolean().optional().nullable()
  }))) body: { embryoId: string; testType?: string; result?: string | null; euploid?: boolean | null }) {
    return this.cycles.addPgt({ cycleId: id, ...body });
  }

  @Get(':id/pgt')
  @RequirePermissions('embryology:view')
  pgt(@Param('id') id: string) {
    return this.cycles.pgtResults(id);
  }
}
