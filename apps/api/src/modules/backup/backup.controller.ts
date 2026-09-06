import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { AuthGuard } from '../../common/auth.guard';
import { RequirePermissions } from '../../common/permissions.guard';
import { DatabaseService } from '../../common/database.service';
import { ConfigService } from '../../common/config.service';

@ApiTags('backup')
@Controller('backup')
@UseGuards(AuthGuard)
export class BackupController {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @Post()
  @RequirePermissions('backup:create')
  async create(): Promise<unknown> {
    const dir = this.config.standalone.backupDir || path.join(process.cwd(), '.ficms-data', 'backups');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `ficms-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    const result = await this.db.backupTo(file);
    return { ok: true, path: result.path, bytes: result.bytes };
  }

  @Get('integrity')
  @RequirePermissions('backup:view')
  integrity(): Promise<{ ok: boolean; detail?: string }> {
    return this.db.integrity();
  }
}
