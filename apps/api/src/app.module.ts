import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CoreModule } from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { CyclesModule } from './modules/cycles/cycles.module';
import { LaboratoryModule } from './modules/laboratory/laboratory.module';
import { CryobankModule } from './modules/cryobank/cryobank.module';
import { FinanceModule } from './modules/finance/finance.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SyncModule } from './modules/sync/sync.module';
import { BackupModule } from './modules/backup/backup.module';
import { HealthModule } from './modules/health/health.module';
import { AuthGuard } from './common/auth.guard';
import { PermissionsGuard } from './common/permissions.guard';
import { RateLimitGuard } from './common/rate-limit.guard';
import { AllExceptionsFilter } from './common/http-exception.filter';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    ClinicalModule,
    CyclesModule,
    LaboratoryModule,
    CryobankModule,
    FinanceModule,
    InventoryModule,
    SettingsModule,
    ReportsModule,
    DocumentsModule,
    SyncModule,
    BackupModule,
    HealthModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter }
  ]
})
export class AppModule {}
