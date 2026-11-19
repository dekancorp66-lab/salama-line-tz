import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { RolesGuard } from '../common/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AdminController],
  providers: [RolesGuard, JwtAuthGuard],
})
export class AdminModule {}
