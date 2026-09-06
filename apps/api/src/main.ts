import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from './common/config.service';
import { seedDatabase } from '@ficms/database';
import { DatabaseService } from './common/database.service';

/**
 * FICMS API bootstrap. Used by the connected/on-premise server, by the worker
 * (worker mode) and by the embedded standalone backend (clinic-server).
 */
export interface BootstrapOptions {
  /** Seed roles + admin on a fresh standalone database. */
  seed?: boolean;
  /** Callback fired with the actual bound port (needed for dynamic ports). */
  onListening?: (port: number) => void;
  /** When true, don't call app.listen (useful for programmatic embedding). */
  autoListen?: boolean;
}

export async function bootstrap(options: BootstrapOptions = {}) {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  const config = app.get(ConfigService);

  app.setGlobalPrefix(config.api.apiPrefix);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: config.api.corsOrigin === '*' ? true : config.api.corsOrigin, credentials: true });
  app.enableShutdownHooks();

  if (config.api.nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FICMS API')
      .setDescription('Fertility & IVF Clinic Management System — versioned REST API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, { swaggerOptions: { persistAuthorization: true } });
  }

  await app.init();

  if (options.seed) {
    const db = app.get(DatabaseService);
    await seedDatabase(db.repos);
  }

  if (options.autoListen === false) {
    return app;
  }

  const server = await app.listen(config.api.port, config.api.host);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.api.port;
  options.onListening?.(port);
  // eslint-disable-next-line no-console
  console.log(`[FICMS] API listening on http://${config.api.host}:${port}${config.api.apiPrefix} (mode=${config.standalone.enabled ? 'standalone' : 'server'})`);
  return app;
}

// Run when executed directly (`node dist/main.js`). Safe under ESM transforms
// (e.g. Vitest) where `require` is not defined.
if (typeof require !== 'undefined' && require.main === module) {
  bootstrap({ seed: process.env.FICMS_SEED === 'true' }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start FICMS API', err);
    process.exit(1);
  });
}
