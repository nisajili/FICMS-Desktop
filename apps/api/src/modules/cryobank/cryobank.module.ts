import { Module } from '@nestjs/common';
import { CryobankController } from './cryobank.controller';
import { CryobankService } from './cryobank.service';

@Module({
  controllers: [CryobankController],
  providers: [CryobankService]
})
export class CryobankModule {}
