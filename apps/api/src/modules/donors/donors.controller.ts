import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { DonorsService } from './donors.service';
import { AddDonationSchema, CreateDonorSchema } from './donors.schemas';

@ApiTags('donors')
@Controller('donors')
@UseGuards(AuthGuard)
export class DonorsController {
  constructor(private readonly donors: DonorsService) {}

  @Get()
  @RequirePermissions('donor:view')
  list() {
    return this.donors.list();
  }

  @Post()
  @RequirePermissions('donor:create')
  @ApiOperation({ summary: 'Register a donor (identity encrypted at rest)' })
  create(@Body(new ZodValidationPipe(CreateDonorSchema)) body: Parameters<DonorsService['create']>[0]) {
    return this.donors.create(body);
  }

  @Get('donations')
  @RequirePermissions('donor:view')
  donations(@Query('donorId') donorId?: string) {
    return this.donors.listDonations(donorId);
  }

  @Post('donations')
  @RequirePermissions('donor:create')
  @ApiOperation({ summary: 'Record a donation sample for a donor' })
  addDonation(@Body(new ZodValidationPipe(AddDonationSchema)) body: { donorId: string; sampleBarcode: string }) {
    return this.donors.addDonation(body.donorId, body.sampleBarcode);
  }
}
