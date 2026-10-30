import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { RolesGuard } from '../common/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({ imports: [AuthModule], controllers: [ContentController], providers: [ContentService, RolesGuard, JwtAuthGuard] })
export class ContentModule {}
