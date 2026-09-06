import { Global, Module } from '@nestjs/common';
import { ConfigService } from './common/config.service';
import { DatabaseService } from './common/database.service';
import { FieldCryptoService } from './common/crypto.service';

/** Global providers shared by every feature module. */
@Global()
@Module({
  providers: [ConfigService, DatabaseService, FieldCryptoService],
  exports: [ConfigService, DatabaseService, FieldCryptoService]
})
export class CoreModule {}
