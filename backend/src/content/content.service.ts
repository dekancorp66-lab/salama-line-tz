import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { canManageContent } from '../common/roles';
import { PrismaService } from '../database/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list(language = 'sw', topic?: string) {
    return this.prisma.content.findMany({
      where: { status: ContentStatus.APPROVED, language, ...(topic ? { topic } : {}) },
      select: {
        id: true,
        slug: true,
        title: true,
        language: true,
        topic: true,
        shortText: true,
        fullText: true,
        sourceName: true,
        sourceUrl: true,
        reviewedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async create(dto: CreateContentDto, actor: { id: string; role?: string }) {
    if (!canManageContent(actor.role)) throw new ForbiddenException();
    const content = await this.prisma.content.create({
      data: { ...dto, status: ContentStatus.DRAFT },
      select: { id: true, slug: true, status: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CONTENT_CREATED',
      resourceType: 'CONTENT',
      resourceId: content.id,
      outcome: 'success',
    });
    return content;
  }

  async review(id: string, reviewer: { id: string; role?: string }, approve: boolean, notes?: string) {
    if (!canManageContent(reviewer.role)) throw new ForbiddenException();
    const content = await this.prisma.content.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('Content not found');
    const result = await this.prisma.content.update({
      where: { id },
      data: {
        status: approve ? ContentStatus.APPROVED : ContentStatus.DRAFT,
        reviewerId: reviewer.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
        publishedAt: approve ? new Date() : null,
      },
      select: { id: true, slug: true, status: true, reviewedAt: true },
    });
    await this.audit.record({
      actorUserId: reviewer.id,
      action: approve ? 'CONTENT_APPROVED' : 'CONTENT_RETURNED',
      resourceType: 'CONTENT',
      resourceId: id,
      outcome: 'success',
    });
    return result;
  }
}
