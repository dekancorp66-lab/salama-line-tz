import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { ServicesModule } from './service-directory/services.module';
import { HelpRequestsModule } from './help-requests/help-requests.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    ContentModule,
    ServicesModule,
    HelpRequestsModule,
    AdminModule,
    AuditModule,
    IntegrationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
