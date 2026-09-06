import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/auth.guard';
import { LaboratoryService } from './laboratory.service';

@ApiTags('laboratory')
@Controller('laboratory')
@UseGuards(AuthGuard)
export class LaboratoryController {
  constructor(private readonly lab: LaboratoryService) {}

  @Post('samples')
  @RequirePermissions('andrology:create')
  createSample(@Body(new ZodValidationPipe(z.object({
    patientId: z.string(), collectedAt: z.string(), collectionMethod: z.string().optional(), abstinenceDays: z.number().int().optional().nullable()
  }))) body: Parameters<LaboratoryService['createSample']>[0]) {
    return this.lab.createSample(body);
  }

  @Post('analyses')
  @RequirePermissions('andrology:create')
  addAnalysis(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({
    sampleId: z.string(), volumeMl: z.number().optional().nullable(), concentration: z.number().optional().nullable(), totalMotility: z.number().optional().nullable(), progressiveMotility: z.number().optional().nullable(), morphology: z.number().optional().nullable()
  }))) body: Parameters<LaboratoryService['addAnalysis']>[0]) {
    return this.lab.addAnalysis(body, user.userId);
  }

  @Post('analyses/:id/verify')
  @RequirePermissions('andrology:verify')
  verifyAnalysis(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.lab.verifyAnalysis(id, user.userId);
  }

  @Post('analyses/:id/release')
  @RequirePermissions('andrology:release')
  releaseAnalysis(@Param('id') id: string) {
    return this.lab.releaseAnalysis(id);
  }

  @Post('results')
  @RequirePermissions('laboratory:create')
  enterResult(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({
    investigationId: z.string().optional().nullable(), testId: z.string(), value: z.number().optional().nullable(), valueText: z.string().optional().nullable(), unit: z.string().optional().nullable()
  }))) body: Parameters<LaboratoryService['enterResult']>[0]) {
    return this.lab.enterResult(body, user.userId);
  }

  @Post('results/:id/verify')
  @RequirePermissions('laboratory:verify')
  verifyResult(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.lab.verifyResult(id, user.userId);
  }

  @Post('results/:id/release')
  @RequirePermissions('laboratory:release')
  releaseResult(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.lab.releaseResult(id, user.userId);
  }

  @Get('results')
  @RequirePermissions('laboratory:view')
  results(@Query('patientId') patientId: string) {
    return this.lab.results(patientId);
  }

  @Get('results/critical')
  @RequirePermissions('laboratory:view')
  critical() {
    return this.lab.criticalUnsent();
  }

  @Post('qc')
  @RequirePermissions('laboratory:create')
  qc(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(z.object({ equipment: z.string(), kind: z.string(), result: z.string() }))) body: { equipment: string; kind: string; result: string }) {
    return this.lab.logQc(body, user.userId);
  }

  @Get('qc')
  @RequirePermissions('laboratory:view')
  qcList() {
    return this.lab.qcList();
  }

  @Post('accessions')
  @RequirePermissions('laboratory:create')
  accession(@Body(new ZodValidationPipe(z.object({
    barcode: z.string(), patientId: z.string(), collectedAt: z.string(), collectedById: z.string().optional().nullable(), testIds: z.array(z.string())
  }))) body: Parameters<LaboratoryService['accession']>[0]) {
    return this.lab.accession(body);
  }
}
