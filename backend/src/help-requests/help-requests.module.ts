import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsService } from './help-requests.service';
import { PublicCaseTrackingController } from './public-case-tracking.controller';
import { PublicCaseTrackingService } from './public-case-tracking.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [HelpRequestsController, PublicCaseTrackingController],
  providers: [HelpRequestsService, PublicCaseTrackingService, RolesGuard, JwtAuthGuard],
})
export class HelpRequestsModule {}
