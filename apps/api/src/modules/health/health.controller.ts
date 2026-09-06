import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/permissions.guard';
import { DatabaseService } from '../../common/database.service';
import { ConfigService } from '../../common/config.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @Public()
  @Get()
  async check(): Promise<unknown> {
    const integrity = await this.db.integrity();
    return {
      status: integrity.ok ? 'ok' : 'degraded',
      version: '0.1.0',
      provider: this.db.engine.provider,
      mode: this.config.standalone.enabled ? 'standalone' : 'server',
      database: integrity,
      timestamp: new Date().toISOString()
    };
  }

  @Public()
  @Get('ready')
  ready(): unknown {
    return { ready: true };
  }
}
