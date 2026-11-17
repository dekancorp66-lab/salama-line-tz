import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Channel,
  ConsentDecision,
  ConsentPurpose,
  HelpRequestPriority,
  HelpRequestStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { canManageCases, isAdminRole } from '../common/roles';
import { PrismaService } from '../database/prisma.service';
import { AssignCaseDto } from './dto/assign-case.dto';
import { CreateCaseNoteDto } from './dto/create-case-note.dto';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateReferralDto } from './dto/create-referral.dto';
import { EscalateCaseDto } from './dto/escalate-case.dto';
import { GrantConsentDto } from './dto/grant-consent.dto';
import { RevokeConsentDto } from './dto/revoke-consent.dto';

export interface CaseActor {
  id: string;
  role?: string | null;
  districtCode?: string | null;
}

interface CaseAccessRecord {
  districtCode: string;
  assignedResponderId: string | null;
  escalationCount?: number;
}

const OPEN_STATUSES: HelpRequestStatus[] = [
  HelpRequestStatus.NEW,
  HelpRequestStatus.PENDING,
  HelpRequestStatus.PENDING_REVIEW,
  HelpRequestStatus.ACCEPTED,
  HelpRequestStatus.ASSIGNED,
  HelpRequestStatus.IN_PROGRESS,
  HelpRequestStatus.ESCALATED,
  HelpRequestStatus.REFERRED,
];

const TERMINAL_STATUSES: HelpRequestStatus[] = [
  HelpRequestStatus.RESOLVED,
  HelpRequestStatus.CLOSED,
  HelpRequestStatus.CANCELLED,
  HelpRequestStatus.EXPIRED,
];

/** Only these forward moves are legal. Terminal states accept no transitions. */
export const CASE_TRANSITIONS: Record<HelpRequestStatus, HelpRequestStatus[]> = {
  [HelpRequestStatus.NEW]: [
    HelpRequestStatus.PENDING,
    HelpRequestStatus.PENDING_REVIEW,
    HelpRequestStatus.CANCELLED,
  ],
  [HelpRequestStatus.PENDING]: [
    HelpRequestStatus.ACCEPTED,
    HelpRequestStatus.ASSIGNED,
    HelpRequestStatus.PENDING_REVIEW,
    HelpRequestStatus.CANCELLED,
    HelpRequestStatus.EXPIRED,
  ],
  [HelpRequestStatus.PENDING_REVIEW]: [
    HelpRequestStatus.ACCEPTED,
    HelpRequestStatus.ASSIGNED,
    HelpRequestStatus.CANCELLED,
  ],
  [HelpRequestStatus.ACCEPTED]: [
    HelpRequestStatus.IN_PROGRESS,
    HelpRequestStatus.ASSIGNED,
    HelpRequestStatus.ESCALATED,
    HelpRequestStatus.REFERRED,
    HelpRequestStatus.RESOLVED,
    HelpRequestStatus.CLOSED,
    HelpRequestStatus.CANCELLED,
  ],
  [HelpRequestStatus.ASSIGNED]: [
    HelpRequestStatus.IN_PROGRESS,
    HelpRequestStatus.ESCALATED,
    HelpRequestStatus.REFERRED,
    HelpRequestStatus.RESOLVED,
    HelpRequestStatus.CLOSED,
    HelpRequestStatus.CANCELLED,
  ],
  [HelpRequestStatus.IN_PROGRESS]: [
    HelpRequestStatus.ESCALATED,
    HelpRequestStatus.REFERRED,
    HelpRequestStatus.RESOLVED,
    HelpRequestStatus.CLOSED,
    HelpRequestStatus.CANCELLED,
  ],
  [HelpRequestStatus.ESCALATED]: [
    HelpRequestStatus.IN_PROGRESS,
    HelpRequestStatus.REFERRED,
    HelpRequestStatus.RESOLVED,
    HelpRequestStatus.CLOSED,
    HelpRequestStatus.CANCELLED,
  ],
  [HelpRequestStatus.REFERRED]: [
    HelpRequestStatus.IN_PROGRESS,
    HelpRequestStatus.RESOLVED,
    HelpRequestStatus.CLOSED,
    HelpRequestStatus.CANCELLED,
  ],
  [HelpRequestStatus.RESOLVED]: [HelpRequestStatus.CLOSED, HelpRequestStatus.CANCELLED],
  [HelpRequestStatus.CLOSED]: [],
  [HelpRequestStatus.CANCELLED]: [],
  [HelpRequestStatus.EXPIRED]: [],
};

const CASE_VIEW_SELECT = {
  id: true,
  caseCode: true,
  topic: true,
  concernSummary: true,
  districtCode: true,
  channel: true,
  status: true,
  priority: true,
  assignedResponderId: true,
  consentToContact: true,
  acceptedAt: true,
  assignedAt: true,
  escalatedAt: true,
  resolvedAt: true,
  closedAt: true,
  expiresAt: true,
  lastAlertAt: true,
  escalationCount: true,
  createdAt: true,
};

@Injectable()
export class HelpRequestsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private hashContact(value: string) {
    const key = process.env.CONTACT_HASH_SECRET;
    if (!key || key.length < 32) {
      throw new BadRequestException(
        'Contact storage is not configured; submit without contact or configure CONTACT_HASH_SECRET',
      );
    }
    return createHash('sha256').update(`${key}:${value.trim()}`).digest('hex');
  }

  /**
   * Defense in depth for free-text fields. Emails, phone numbers and long digit
   * runs are replaced before persistence. The result is a short summary, never
   * the raw message. Used for concern text and staff notes.
   */
  redactText(input: string, maxLength = 500): string {
    return input
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[contact removed]')
      .replace(/\+?\d[\d\s().-]{7,}\d/g, '[contact removed]')
      .replace(/\b\d{6,}\b/g, '[contact removed]')
      .replace(/\b(my name is|name:)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/gi, '$1 [name removed]')
      .replace(
        /\b((?:my|our)\s+(?:daughter|son|sister|brother|mother|father|wife|husband|child|friend))\s+(?:is\s+)?[A-Z][a-z]+/g,
        '$1 [name removed]',
      )
      .replace(/\bcalled\s+[A-Z][a-z]+/g, 'called [name removed]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength)
      .trim();
  }

  private assertCanManageCase(record: CaseAccessRecord, actor: CaseActor) {
    if (isAdminRole(actor.role)) return;
    if (!canManageCases(actor.role)) {
      throw new ForbiddenException('Insufficient permissions for this case');
    }
    if (!actor.districtCode?.trim()) {
      throw new ForbiddenException('Responder is not assigned to a district');
    }
    if (record.districtCode.toUpperCase() !== actor.districtCode.trim().toUpperCase()) {
      throw new ForbiddenException('Case is outside your authorized district');
    }
    if (record.assignedResponderId && record.assignedResponderId !== actor.id) {
      throw new ForbiddenException('Case is assigned to another responder');
    }
  }

  private async loadCase(id: string, actor: CaseActor) {
    const record = await this.prisma.helpRequest.findUnique({
      where: { id },
      select: {
        id: true,
        districtCode: true,
        assignedResponderId: true,
        status: true,
        escalationCount: true,
      },
    });
    if (!record) throw new NotFoundException('Help request not found');
    this.assertCanManageCase(record, actor);
    return record;
  }

  async create(dto: CreateHelpRequestDto) {
    if (dto.anonymousReport && dto.contact) {
      throw new BadRequestException('Anonymous reports must not include contact details');
    }
    const consentToContact = dto.anonymousReport ? false : dto.consentToContact;
    if (consentToContact && !dto.contact) {
      throw new BadRequestException('Contact is required only when consent to contact is granted');
    }
    if (dto.contact && !consentToContact) {
      throw new BadRequestException('Do not submit contact details without explicit consent');
    }
    // Contact encryption is intentionally not implemented with an implicit/static
    // key. The hash is for deduplication only and cannot be used to contact them.
    const contactHash = dto.contact ? this.hashContact(dto.contact) : null;
    const concernSummary = dto.concernSummary?.trim()
      ? this.redactText(dto.concernSummary)
      : null;
    const caseCode = `SL-${randomBytes(4).toString('hex').toUpperCase()}`;
    const result = await this.prisma.helpRequest.create({
      data: {
        caseCode,
        topic: dto.topic.trim(),
        concernSummary,
        districtCode: dto.districtCode.trim().toUpperCase(),
        channel: dto.channel as Channel,
        priority: dto.priority === 'URGENT' ? HelpRequestPriority.URGENT : HelpRequestPriority.NORMAL,
        consentToContact,
        contactHash,
        status: HelpRequestStatus.PENDING,
        consents: {
          create: [
            {
              purpose: ConsentPurpose.CONTACT_FOR_HELP,
              decision: consentToContact ? ConsentDecision.GRANTED : ConsentDecision.DECLINED,
              wordingVersion: 'salama-consent-v1',
              channel: dto.channel as Channel,
            },
          ],
        },
      },
      select: {
        id: true,
        caseCode: true,
        topic: true,
        concernSummary: true,
        districtCode: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });
    await this.audit.record({
      action: 'HELP_REQUEST_CREATED',
      resourceType: 'HELP_REQUEST',
      resourceId: result.id,
      outcome: 'success',
    });
    return {
      ...result,
      message:
        'Request recorded. A trained responder must review it. This API does not automatically contact emergency services.',
    };
  }

  /**
   * Fail closed: responders without a district never receive a cross-district
   * query. Only explicitly authorized administrators may request all districts.
   */
  listForStaff(districtCode?: string, allowAllDistricts = false) {
    if (!allowAllDistricts && !districtCode?.trim()) return Promise.resolve([]);
    return this.prisma.helpRequest.findMany({
      where: {
        ...(allowAllDistricts ? {} : { districtCode: districtCode!.trim().toUpperCase() }),
        status: { in: OPEN_STATUSES },
      },
      select: {
        id: true,
        caseCode: true,
        topic: true,
        districtCode: true,
        channel: true,
        status: true,
        priority: true,
        assignedResponderId: true,
        createdAt: true,
        escalationCount: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** Single-case view. Never returns contactHash or contactCiphertext. */
  async getCase(id: string, actor: CaseActor) {
    await this.loadCase(id, actor);
    const record = await this.prisma.helpRequest.findUnique({
      where: { id },
      select: {
        ...CASE_VIEW_SELECT,
        consents: {
          select: {
            purpose: true,
            decision: true,
            wordingVersion: true,
            channel: true,
            createdAt: true,
            revokedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          select: { id: true, note: true, authorId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!record) throw new NotFoundException('Help request not found');
    return record;
  }

  async updateStatus(id: string, status: HelpRequestStatus, actor: CaseActor) {
    const current = await this.loadCase(id, actor);

    if (!CASE_TRANSITIONS[current.status].includes(status)) {
      throw new BadRequestException(
        `Illegal case transition: ${current.status} -> ${status}`,
      );
    }

    const now = new Date();
    const closing =
      status === HelpRequestStatus.CLOSED ||
      status === HelpRequestStatus.CANCELLED ||
      status === HelpRequestStatus.EXPIRED;
    const result = await this.prisma.helpRequest.update({
      where: { id },
      data: {
        status,
        ...(status === HelpRequestStatus.ACCEPTED
          ? {
              acceptedAt: now,
              assignedAt: now,
              ...(!current.assignedResponderId && actor.role === 'RESPONDER'
                ? { assignedResponderId: actor.id }
                : {}),
            }
          : {}),
        ...(status === HelpRequestStatus.RESOLVED ? { resolvedAt: now } : {}),
        ...(closing
          ? {
              closedAt: now,
              ...(status === HelpRequestStatus.EXPIRED ? { expiresAt: now } : {}),
              contactCiphertext: null,
              contactHash: null,
              consentToContact: false,
            }
          : {}),
      },
      select: {
        id: true,
        caseCode: true,
        status: true,
        assignedResponderId: true,
        acceptedAt: true,
        closedAt: true,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'HELP_REQUEST_STATUS_UPDATED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: status,
    });
    return result;
  }

  async assign(id: string, dto: AssignCaseDto, actor: CaseActor) {
    const current = await this.loadCase(id, actor);
    if (current.assignedResponderId && !dto.force && !isAdminRole(actor.role)) {
      throw new ForbiddenException('Case is already assigned; an administrator must reassign it');
    }
    if (TERMINAL_STATUSES.includes(current.status)) {
      throw new BadRequestException('A closed case cannot be assigned');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: dto.responderId },
      select: { id: true, role: true, districtCode: true, isActive: true },
    });
    if (!target || target.role !== 'RESPONDER' || !target.isActive) {
      throw new BadRequestException('Target must be an active responder account');
    }
    if (current.districtCode.toUpperCase() !== target.districtCode?.trim().toUpperCase()) {
      throw new BadRequestException('Target responder is not assigned to this case district');
    }

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.helpRequest.update({
        where: { id },
        data: {
          status: HelpRequestStatus.ASSIGNED,
          assignedResponderId: target.id,
          assignedAt: now,
          ...(current.status === HelpRequestStatus.NEW || current.status === HelpRequestStatus.PENDING
            ? { acceptedAt: now }
            : {}),
        },
        select: CASE_VIEW_SELECT,
      }),
      this.prisma.caseAssignmentEvent.create({
        data: {
          helpRequestId: id,
          fromResponderId: current.assignedResponderId,
          toResponderId: target.id,
          actorId: actor.id,
          reason: dto.reason ? this.redactText(dto.reason, 240) : null,
        },
        select: { id: true },
      }),
    ]);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_ASSIGNED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: 'success',
    });
    return updated;
  }

  async listNotes(id: string, actor: CaseActor) {
    await this.loadCase(id, actor);
    return this.prisma.caseNote.findMany({
      where: { helpRequestId: id },
      select: { id: true, note: true, authorId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addNote(id: string, dto: CreateCaseNoteDto, actor: CaseActor) {
    await this.loadCase(id, actor);
    const note = this.redactText(dto.note, 2000);
    const meaningful = note.replace(/\[(?:contact|name) removed\]/g, '').trim();
    if (meaningful.length < 2) {
      throw new BadRequestException('Note contains no case metadata after redaction');
    }
    const result = await this.prisma.caseNote.create({
      data: { helpRequestId: id, authorId: actor.id, note },
      select: { id: true, note: true, authorId: true, createdAt: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_NOTE_ADDED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: 'success',
    });
    return result;
  }

  async escalate(id: string, dto: EscalateCaseDto, actor: CaseActor) {
    const current = await this.loadCase(id, actor);
    if (TERMINAL_STATUSES.includes(current.status)) {
      throw new BadRequestException('A closed case cannot be escalated');
    }
    const now = new Date();
    const escalationCount = (current.escalationCount ?? 0) + 1;
    const [updated] = await this.prisma.$transaction([
      this.prisma.helpRequest.update({
        where: { id },
        data: {
          status: HelpRequestStatus.ESCALATED,
          escalatedAt: now,
          lastAlertAt: now,
          escalationCount,
        },
        select: CASE_VIEW_SELECT,
      }),
      this.prisma.escalationEvent.create({
        data: {
          helpRequestId: id,
          actorId: actor.id,
          reason: dto.reason ? this.redactText(dto.reason, 240) : null,
          escalationCount,
        },
        select: { id: true },
      }),
      // Metadata-only outbox row. No destination or message body is stored,
      // and nothing is transmitted automatically.
      this.prisma.notificationOutbox.create({
        data: {
          helpRequestId: id,
          channel: Channel.STAFF,
          templateKey: 'CASE_ESCALATION_REVIEW',
          destinationHash: null,
          status: 'PENDING',
        },
        select: { id: true },
      }),
    ]);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_ESCALATED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: 'success',
    });
    return updated;
  }

  /** Records a specific, versioned consent grant for a purpose. */
  async grantConsent(id: string, dto: GrantConsentDto, actor: CaseActor) {
    await this.loadCase(id, actor);
    const result = await this.prisma.consentRecord.create({
      data: {
        helpRequestId: id,
        purpose: dto.purpose,
        decision: ConsentDecision.GRANTED,
        wordingVersion: dto.wordingVersion?.trim() || 'salama-consent-v1',
        channel: Channel.STAFF,
      },
      select: {
        id: true,
        purpose: true,
        decision: true,
        wordingVersion: true,
        channel: true,
        createdAt: true,
        revokedAt: true,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_CONSENT_GRANTED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: dto.purpose,
    });
    return result;
  }

  async revokeConsent(id: string, dto: RevokeConsentDto, actor: CaseActor) {
    await this.loadCase(id, actor);
    const now = new Date();
    const active = await this.prisma.consentRecord.findMany({
      where: {
        helpRequestId: id,
        purpose: dto.purpose,
        decision: ConsentDecision.GRANTED,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!active.length) {
      throw new BadRequestException('There is no active consent of that purpose to revoke');
    }

    await this.prisma.$transaction([
      ...active.map((record) =>
        this.prisma.consentRecord.update({
          where: { id: record.id },
          data: { revokedAt: now },
        }),
      ),
      this.prisma.consentRecord.create({
        data: {
          helpRequestId: id,
          purpose: dto.purpose,
          decision: ConsentDecision.REVOKED,
          wordingVersion: 'salama-consent-v1',
          channel: Channel.STAFF,
          revokedAt: now,
        },
        select: { id: true },
      }),
      // Revoking contact consent also removes any stored contact identifiers.
      ...(dto.purpose === ConsentPurpose.CONTACT_FOR_HELP
        ? [
            this.prisma.helpRequest.update({
              where: { id },
              data: {
                consentToContact: false,
                contactHash: null,
                contactCiphertext: null,
              },
            }),
          ]
        : []),
    ]);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_CONSENT_REVOKED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: dto.purpose,
    });
    return { revokedAt: now, purpose: dto.purpose };
  }

  async createReferral(id: string, dto: CreateReferralDto, actor: CaseActor) {
    await this.loadCase(id, actor);
    const service = await this.prisma.serviceDirectoryEntry.findUnique({
      where: { id: dto.serviceEntryId },
      select: { id: true, isActive: true, expiresAt: true },
    });
    if (!service || !service.isActive) {
      throw new BadRequestException('Referral target must be an active verified service');
    }
    if (service.expiresAt && service.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Referral target verification has expired');
    }
    const consent = await this.prisma.consentRecord.findFirst({
      where: {
        helpRequestId: id,
        decision: ConsentDecision.GRANTED,
        revokedAt: null,
        // Sharing with a service needs its own specific consent. General
        // contact consent only permits a responder to contact the reporter.
        purpose: ConsentPurpose.SHARE_WITH_SERVICE,
      },
      select: { id: true },
    });
    if (!consent) {
      throw new ForbiddenException('No active SHARE_WITH_SERVICE consent exists for this case');
    }

    const result = await this.prisma.referral.create({
      data: {
        helpRequestId: id,
        serviceEntryId: service.id,
        consentGranted: true,
        status: 'OFFERED',
      },
      select: {
        id: true,
        helpRequestId: true,
        serviceEntryId: true,
        status: true,
        consentGranted: true,
        createdAt: true,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_REFERRAL_CREATED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: 'success',
    });
    return result;
  }

  async listReferrals(id: string, actor: CaseActor) {
    await this.loadCase(id, actor);
    return this.prisma.referral.findMany({
      where: { helpRequestId: id },
      select: {
        id: true,
        helpRequestId: true,
        serviceEntryId: true,
        status: true,
        consentGranted: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retention sweep: open cases older than the configured window are expired
   * and all contact identifiers are wiped. Never contacts any third party.
   */
  async sweepExpired() {
    const retentionHours = Number(process.env.CASE_RETENTION_HOURS || 168);
    const hours = Number.isFinite(retentionHours) && retentionHours > 0 ? retentionHours : 168;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const candidates = await this.prisma.helpRequest.findMany({
      where: { status: { in: OPEN_STATUSES }, createdAt: { lt: cutoff } },
      select: { id: true },
    });
    let expired = 0;
    for (const candidate of candidates) {
      await this.prisma.helpRequest.update({
        where: { id: candidate.id },
        data: {
          status: HelpRequestStatus.EXPIRED,
          expiresAt: new Date(),
          closedAt: new Date(),
          contactHash: null,
          contactCiphertext: null,
          consentToContact: false,
          concernSummary: null,
        },
      });
      await this.audit.record({
        action: 'CASE_EXPIRED_RETENTION',
        resourceType: 'HELP_REQUEST',
        resourceId: candidate.id,
        outcome: 'success',
      });
      expired += 1;
    }
    return { expired };
  }
}
