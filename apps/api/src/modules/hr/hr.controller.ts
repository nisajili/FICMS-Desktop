import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { HrService } from './hr.service';
import { AttendanceSchema, CreateProfileSchema, LeaveSchema, LeaveStatusSchema, QualificationsSchema } from './hr.schemas';

@ApiTags('hr')
@Controller('hr')
@UseGuards(AuthGuard)
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('staff')
  @RequirePermissions('hr:view')
  listStaff() {
    return this.hr.listStaff();
  }

  @Post('staff')
  @RequirePermissions('hr:create')
  @ApiOperation({ summary: 'Create a staff profile (links an auth user to HR records)' })
  createProfile(@Body(new ZodValidationPipe(CreateProfileSchema)) body: Parameters<HrService['createProfile']>[0]) {
    return this.hr.createProfile(body);
  }

  @Get('staff/:userId')
  @RequirePermissions('hr:view')
  profileForUser(@Param('userId') userId: string) {
    return this.hr.profileForUser(userId);
  }

  @Post('attendance')
  @RequirePermissions('hr:create')
  attendance(@Body(new ZodValidationPipe(AttendanceSchema)) body: { staffId: string; date: string; checkIn?: string | null; checkOut?: string | null }) {
    return this.hr.attendance(body);
  }

  @Post('leave')
  @RequirePermissions('hr:create')
  requestLeave(@Body(new ZodValidationPipe(LeaveSchema)) body: { staffId: string; type?: string; startDate: string; endDate: string }) {
    return this.hr.requestLeave(body);
  }

  @Patch('leave/:id')
  @RequirePermissions('hr:update')
  leaveStatus(@Param('id') id: string, @Body(new ZodValidationPipe(LeaveStatusSchema)) body: { status: string }) {
    return this.hr.leaveStatus(id, body.status);
  }

  @Patch('staff/:id/qualifications')
  @RequirePermissions('hr:update')
  setQualifications(@Param('id') id: string, @Body(new ZodValidationPipe(QualificationsSchema)) body: { qualifications: unknown[] }) {
    return this.hr.setQualifications(id, body.qualifications);
  }
}
