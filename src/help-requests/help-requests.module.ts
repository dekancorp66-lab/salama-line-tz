import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsService } from './help-requests.service';
import { RolesGuard } from '../common/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({ imports: [AuthModule], controllers: [HelpRequestsController], providers: [HelpRequestsService, RolesGuard, JwtAuthGuard] })
export class HelpRequestsModule {}
