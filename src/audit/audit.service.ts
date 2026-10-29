import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  record(input: { actorUserId?: string; action: string; resourceType: string; resourceId?: string; outcome: string; requestId?: string }) {
    // Never include message text, names, contact numbers, tokens, or case details in audit metadata.
    return this.prisma.auditEvent.create({ data: input });
  }
}
