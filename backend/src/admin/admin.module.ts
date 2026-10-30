import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { RolesGuard } from '../common/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({ imports: [AuthModule], controllers: [AdminController], providers: [RolesGuard, JwtAuthGuard] })
export class AdminModule {}
