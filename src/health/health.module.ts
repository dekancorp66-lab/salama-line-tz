import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  getHealth() { return { status: 'ok', service: 'salamaline-api', timestamp: new Date().toISOString() }; }
  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', database: 'connected' };
  }
}
import { Module } from '@nestjs/common';
@Module({ controllers: [HealthController] })
export class HealthModule {}
