import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}
  list(language = 'sw', topic?: string) {
    return this.prisma.content.findMany({
      where: { status: ContentStatus.APPROVED, language, ...(topic ? { topic } : {}) },
      select: { id: true, slug: true, title: true, language: true, topic: true, shortText: true, fullText: true, sourceName: true, sourceUrl: true, reviewedAt: true },
      orderBy: { publishedAt: 'desc' },
    });
  }
  create(dto: CreateContentDto) {
    return this.prisma.content.create({ data: { ...dto, status: ContentStatus.DRAFT } });
  }
  async review(id: string, reviewer: { id: string; role: UserRole }, approve: boolean, notes?: string) {
    if (reviewer.role !== UserRole.ADMIN && reviewer.role !== UserRole.CONTENT_REVIEWER) throw new ForbiddenException();
    const content = await this.prisma.content.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('Content not found');
    return this.prisma.content.update({
      where: { id },
      data: {
        status: approve ? ContentStatus.APPROVED : ContentStatus.DRAFT,
        reviewerId: reviewer.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
        publishedAt: approve ? new Date() : null,
      },
    });
  }
}
