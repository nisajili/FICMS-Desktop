import { BadRequestException, Body, Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/auth.guard';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @RequirePermissions('patient:update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer; size: number } | undefined,
    @CurrentUser() user: RequestUser,
    @Body() body: { patientId?: string; refType?: string; refId?: string }
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return this.documents.store(file, { ...body, uploadedById: user.userId });
  }

  @Get('patient/:patientId')
  @RequirePermissions('patient:view')
  list(@Param('patientId') patientId: string) {
    return this.documents.list(patientId);
  }

  @Get(':id')
  @RequirePermissions('patient:view')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { doc, data } = await this.documents.read(id);
    res.setHeader('Content-Type', String(doc.mime_type));
    res.setHeader('Content-Disposition', `attachment; filename="${String(doc.name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
    res.send(data);
  }
}
