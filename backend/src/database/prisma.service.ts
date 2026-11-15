import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      // Keep database-independent routes (health, AI, and public content) online.
      // Prisma will retry its connection when a database-backed request is made.
      this.logger.warn('Database connection unavailable during startup; database-backed requests may fail until it recovers.');
    }
  }

  async onModuleDestroy() { await this.$disconnect(); }
}
