import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Channel, ConsentDecision, ConsentPurpose, HelpRequestPriority, HelpRequestStatus } from '@prisma/client';
import { randomBytes, createHash, createCipheriv } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';

@Injectable()
export class HelpRequestsService {
  constructor(private prisma: PrismaService) {}
  private hashContact(value: string) {
    const key = process.env.CONTACT_HASH_SECRET;
    if (!key || key.length < 32) throw new BadRequestException('Contact storage is not configured; submit without contact or configure CONTACT_HASH_SECRET');
    return createHash('sha256').update(`${key}:${value.trim()}`).digest('hex');
  }
  async create(dto: CreateHelpRequestDto) {
    if (dto.consentToContact && !dto.contact) throw new BadRequestException('Contact is required only when consent to contact is granted');
    if (dto.contact && !dto.consentToContact) throw new BadRequestException('Do not submit contact details without explicit consent');
    // Contact encryption is intentionally not implemented with an implicit/static key.
    // Hash is useful for deduplication but cannot be used to contact the person.
    const contactHash = dto.contact ? this.hashContact(dto.contact) : null;
    const caseCode = `SL-${randomBytes(4).toString('hex').toUpperCase()}`;
    const result = await this.prisma.helpRequest.create({
      data: {
        caseCode, topic: dto.topic.trim(), districtCode: dto.districtCode.trim().toUpperCase(),
        channel: dto.channel as Channel,
        priority: dto.priority === 'URGENT' ? HelpRequestPriority.URGENT : HelpRequestPriority.NORMAL,
        consentToContact: dto.consentToContact,
        contactHash,
        status: HelpRequestStatus.PENDING,
        consents: { create: [{
          purpose: ConsentPurpose.CONTACT_FOR_HELP,
          decision: dto.consentToContact ? ConsentDecision.GRANTED : ConsentDecision.DECLINED,
          wordingVersion: 'salama-consent-v1',
          channel: dto.channel as Channel,
        }] },
      },
      select: { id: true, caseCode: true, topic: true, districtCode: true, status: true, priority: true, createdAt: true },
    });
    return { ...result, message: 'Request recorded. A trained responder must review it. This API does not automatically contact emergency services.' };
  }
  listForStaff(districtCode?: string) {
    return this.prisma.helpRequest.findMany({
      where: { ...(districtCode ? { districtCode: districtCode.toUpperCase() } : {}), status: { notIn: [HelpRequestStatus.CLOSED, HelpRequestStatus.CANCELLED] } },
      select: { id: true, caseCode: true, topic: true, districtCode: true, channel: true, status: true, priority: true, assignedResponderId: true, createdAt: true, escalationCount: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }
  async updateStatus(id: string, status: HelpRequestStatus, responderId: string) {
    const current = await this.prisma.helpRequest.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Help request not found');
    if (status === HelpRequestStatus.CLOSED) {
      // Contact identifiers are not stored in plaintext in this baseline; clear any future protected fields too.
      return this.prisma.helpRequest.update({ where: { id }, data: { status, closedAt: new Date(), contactCiphertext: null, contactHash: null, consentToContact: false } });
    }
    return this.prisma.helpRequest.update({ where: { id }, data: {
      status, ...(status === HelpRequestStatus.ACCEPTED ? { acceptedAt: new Date(), assignedResponderId: responderId } : {}),
    }, select: { id: true, caseCode: true, status: true, assignedResponderId: true, acceptedAt: true, closedAt: true } });
  }
}
