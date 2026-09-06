import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions, Public } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('clinic')
  @RequirePermissions('settings:view')
  get() {
    return this.settings.get();
  }

  @Patch('clinic')
  @RequirePermissions('settings:update')
  update(@Body() body: Record<string, unknown>) {
    return this.settings.update(body);
  }

  @Get('branches')
  @RequirePermissions('settings:view')
  branches() {
    return this.settings.branches();
  }

  @Post('branches')
  @RequirePermissions('settings:update')
  createBranch(@Body(new ZodValidationPipe(z.object({ name: z.string(), code: z.string(), address: z.record(z.unknown()).optional(), phone: z.string().optional() }))) body: { name: string; code: string; address?: object; phone?: string }) {
    return this.settings.createBranch(body);
  }

  @Get('departments')
  @RequirePermissions('settings:view')
  departments() {
    return this.settings.departments();
  }

  @Post('departments')
  @RequirePermissions('settings:update')
  createDepartment(@Body(new ZodValidationPipe(z.object({ name: z.string(), branchId: z.string().optional().nullable() }))) body: { name: string; branchId?: string | null }) {
    return this.settings.createDepartment(body);
  }

  @Get('services')
  @RequirePermissions('settings:view')
  services() {
    return this.settings.services();
  }

  @Post('services')
  @RequirePermissions('settings:update')
  createService(@Body(new ZodValidationPipe(z.object({
    code: z.string(), name: z.string(), category: z.string().optional(), priceMinor: z.number().int().min(0), currency: z.string().optional()
  }))) body: Parameters<SettingsService['createService']>[0]) {
    return this.settings.createService(body);
  }

  @Get('tests')
  @RequirePermissions('settings:view')
  tests() {
    return this.settings.tests();
  }

  @Post('tests')
  @RequirePermissions('settings:update')
  createTest(@Body(new ZodValidationPipe(z.object({
    code: z.string(), name: z.string(), category: z.string().optional(), unit: z.string().optional().nullable(), referenceLow: z.number().optional().nullable(), referenceHigh: z.number().optional().nullable(), referenceText: z.string().optional().nullable(), criticalLow: z.number().optional().nullable(), criticalHigh: z.number().optional().nullable()
  }))) body: Parameters<SettingsService['createTest']>[0]) {
    return this.settings.createTest(body);
  }

  @Get('medications')
  @RequirePermissions('settings:view')
  medications() {
    return this.settings.medications();
  }

  @Post('medications')
  @RequirePermissions('settings:update')
  createMedication(@Body(new ZodValidationPipe(z.object({
    code: z.string(), name: z.string(), form: z.string().optional().nullable(), strength: z.string().optional().nullable(), controlledSubstance: z.boolean().optional()
  }))) body: Parameters<SettingsService['createMedication']>[0]) {
    return this.settings.createMedication(body);
  }

  @Get('form-templates')
  @RequirePermissions('settings:view')
  formTemplates() {
    return this.settings.formTemplates();
  }

  @Post('form-templates')
  @RequirePermissions('settings:update')
  createFormTemplate(@Body(new ZodValidationPipe(z.object({ code: z.string(), title: z.string(), schema: z.record(z.unknown()).optional(), kind: z.string().optional() }))) body: Parameters<SettingsService['createFormTemplate']>[0]) {
    return this.settings.createFormTemplate(body);
  }

  @Get('consent-templates')
  @RequirePermissions('settings:view')
  consentTemplates() {
    return this.settings.consentTemplates();
  }

  @Post('consent-templates')
  @RequirePermissions('settings:update')
  createConsentTemplate(@Body(new ZodValidationPipe(z.object({ code: z.string(), title: z.string(), body: z.string().optional() }))) body: Parameters<SettingsService['createConsentTemplate']>[0]) {
    return this.settings.createConsentTemplate(body);
  }

  // Public branding endpoint (used by the renderer before login).
  @Public()
  @Get('branding')
  branding() {
    return this.settings.get();
  }
}
