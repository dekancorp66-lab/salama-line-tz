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
import { isSuperAdmin } from '../common/super-admin';
import { PrismaService } from '../database/prisma.service';
import { resolveLocation } from '../location/tanzania-mainland-locations';
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
  institutionId?: string | null;
}

interface CaseAccessRecord {
  districtCode: string;
  districtId?: string | null;
  districtName?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  assignedResponderId: string | null;
  institutionId?: string | null;
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
  regionId: true,
  regionName: true,
  districtId: true,
  districtName: true,
  // Coordinates are intentionally omitted from standard officer views; they are
  // stored only with explicit consent and returned only where explicitly needed.
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

  private normalizeDistrictValue(value: string): string {
    return value.trim().toUpperCase();
  }

  private districtMatches(record: CaseAccessRecord, actorDistrict: string): boolean {
    const target = this.normalizeDistrictValue(actorDistrict);
    if (!target) return false;
    const compactTarget = target.replace(/[^A-Z0-9]+/g, '');
    const rawCandidates = [
      record.districtCode,
      record.districtId,
      record.districtName,
      record.regionId,
      record.regionName,
    ].filter((value): value is string => Boolean(value?.trim()));

    for (const candidate of rawCandidates) {
      const normalized = this.normalizeDistrictValue(candidate);
      if (normalized === target) return true;
      const compact = normalized.replace(/[^A-Z0-9]+/g, '');
      if (compactTarget && compact && compact === compactTarget) return true;
    }

    // Compatibility for legacy district scopes such as "KYELA" matching "Kyela District".
    for (const candidate of rawCandidates) {
      const normalized = this.normalizeDistrictValue(candidate);
      if (
        normalized.startsWith(`${target} `) ||
        normalized.endsWith(` ${target}`) ||
        normalized.includes(` ${target} `)
      ) {
        return true;
      }
    }
    return false;
  }

  private assertCanManageCase(record: CaseAccessRecord, actor: CaseActor) {
    // Super Admin is the only cross-institution role. Every access is audited
    // in loadCase/listForStaff so it remains restricted and reviewable.
    if (isSuperAdmin(actor)) return;

    // Institution isolation is enforced before any district or assignment
    // check. Staff only see cases whose institution exactly matches their own;
    // unassigned (legacy) cases remain hidden until a Super Admin assigns them.
    if ((record.institutionId ?? null) !== (actor.institutionId ?? null)) {
      throw new ForbiddenException('Case is outside your institution');
    }

    if (isAdminRole(actor.role)) return;
    if (!canManageCases(actor.role)) {
      throw new ForbiddenException('Insufficient permissions for this case');
    }
    if (!actor.districtCode?.trim()) {
      throw new ForbiddenException('Responder is not assigned to a district');
    }
    if (!this.districtMatches(record, actor.districtCode)) {
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
        districtId: true,
        districtName: true,
        regionId: true,
        regionName: true,
        assignedResponderId: true,
        institutionId: true,
        status: true,
        escalationCount: true,
      },
    });
    if (!record) throw new NotFoundException('Help request not found');
    this.assertCanManageCase(record, actor);
    if (isSuperAdmin(actor)) {
      await this.audit.record({
        actorUserId: actor.id,
        action: 'CASE_ACCESSED_BY_SUPER_ADMIN',
        resourceType: 'HELP_REQUEST',
        resourceId: record.id,
        outcome: 'success',
      });
    }
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

    const wantsStructuredLocation = Boolean(
      dto.regionId?.trim() ||
        dto.districtId?.trim() ||
        dto.regionName?.trim() ||
        dto.districtName?.trim(),
    );
    const resolved = wantsStructuredLocation
      ? resolveLocation({
          regionId: dto.regionId,
          regionName: dto.regionName,
          districtId: dto.districtId,
          districtName: dto.districtName,
        })
      : null;
    if (wantsStructuredLocation && !resolved) {
      throw new BadRequestException(
        'Select a valid Tanzania Mainland region and a district that belongs to that region',
      );
    }

    const locationConsentGiven = Boolean(dto.locationConsentGiven);
    const hasCoords = typeof dto.latitude === 'number' && typeof dto.longitude === 'number';
    const latitude = locationConsentGiven && hasCoords ? dto.latitude : null;
    const longitude = locationConsentGiven && hasCoords ? dto.longitude : null;

    const districtCode = resolved
      ? resolved.district.id.trim().toUpperCase()
      : dto.districtCode?.trim().toUpperCase();
    if (!districtCode) {
      throw new BadRequestException('A valid district is required');
    }

    // Contact encryption is intentionally not implemented with an implicit/static
    // key. The hash is for deduplication only and cannot be used to contact them.
    const contactHash = dto.contact ? this.hashContact(dto.contact) : null;
    const concernSummary = dto.concernSummary?.trim()
      ? this.redactText(dto.concernSummary)
      : null;
    // 64 bits of CSPRNG entropy. Older 8-hex references remain valid for
    // tracking (see TrackCaseDto) so existing records are not invalidated.
    const caseCode = `SL-${randomBytes(8).toString('hex').toUpperCase()}`;
    const result = await this.prisma.helpRequest.create({
      data: {
        caseCode,
        topic: dto.topic.trim(),
        concernSummary,
        districtCode,
        regionId: resolved?.region.id ?? null,
        regionName: resolved?.region.name ?? null,
        districtId: resolved?.district.id ?? null,
        districtName: resolved?.district.name ?? null,
        latitude,
        longitude,
        locationConsentGiven: latitude !== null && longitude !== null,
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
        regionId: true,
        regionName: true,
        districtId: true,
        districtName: true,
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
   * queue. Institution-scoped staff only ever receive cases assigned to their
   * institution. Only a Super Admin may query across institutions, and that
   * access is audited.
   */
  async listForStaff(districtCode?: string, allowAllDistricts = false, actor?: CaseActor) {
    const districtScope = districtCode?.trim();
    if (!allowAllDistricts && !districtScope) return [];
    const superAdmin = actor ? isSuperAdmin(actor) : false;
    // Fail closed: any non-super-admin actor (including a legacy unscoped one)
    // is confined to its own institution. Unscoped accounts only see legacy
    // cases that are themselves unscoped (institutionId null).
    const institutionFilter: { institutionId: string | null } | Record<string, never> =
      actor && !superAdmin ? { institutionId: actor.institutionId ?? null } : {};
    const applyDistrictFilter = !allowAllDistricts || Boolean(districtScope);
    const result = await this.prisma.helpRequest.findMany({
      where: {
        ...institutionFilter,
        status: { in: OPEN_STATUSES },
      },
      select: {
        id: true,
        caseCode: true,
        topic: true,
        districtCode: true,
        regionId: true,
        regionName: true,
        districtId: true,
        districtName: true,
        institutionId: true,
        channel: true,
        status: true,
        priority: true,
        assignedResponderId: true,
        createdAt: true,
        escalationCount: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    const filtered =
      applyDistrictFilter && districtScope
        ? result.filter((item) => this.districtMatches(item as unknown as CaseAccessRecord, districtScope))
        : result;
    if (superAdmin && actor) {
      await this.audit.record({
        actorUserId: actor.id,
        action: 'CASE_QUEUE_ACCESSED_BY_SUPER_ADMIN',
        resourceType: 'HELP_REQUEST',
        outcome: 'success',
      });
    }
    return filtered;
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
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_VIEWED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: 'success',
    });
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
              latitude: null,
              longitude: null,
              locationConsentGiven: false,
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
      select: { id: true, role: true, districtCode: true, institutionId: true, isActive: true },
    });
    if (!target || target.role !== 'RESPONDER' || !target.isActive) {
      throw new BadRequestException('Target must be an active responder account');
    }
    if (current.institutionId && target.institutionId !== current.institutionId) {
      throw new BadRequestException('Target responder is not authorised for this case institution');
    }
    const targetDistrict = target.districtCode?.trim();
    if (!targetDistrict || !this.districtMatches(current as unknown as CaseAccessRecord, targetDistrict)) {
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

  /**
   * Explicitly grants an institution access to a case. Only a Super Admin may
   * do this; the authorisation itself is recorded in the audit log.
   */
  async assignInstitution(id: string, institutionId: string, actor: CaseActor) {
    await this.loadCase(id, actor);
    if (!isSuperAdmin(actor)) {
      throw new ForbiddenException('Only a Super Admin can assign a case to an institution');
    }
    const scope = institutionId.trim();
    if (scope) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: scope },
        select: { id: true, isActive: true },
      });
      if (!institution || !institution.isActive) {
        throw new BadRequestException('Institution must be an active institution');
      }
    }
    const result = await this.prisma.helpRequest.update({
      where: { id },
      data: { institutionId: scope || null },
      select: { id: true, caseCode: true, institutionId: true },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_INSTITUTION_ASSIGNED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: scope ? 'assigned' : 'cleared',
    });
    return result;
  }

  async listNotes(id: string, actor: CaseActor) {
    await this.loadCase(id, actor);
    const result = await this.prisma.caseNote.findMany({
      where: { helpRequestId: id },
      select: { id: true, note: true, authorId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_NOTES_VIEWED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: 'success',
    });
    return result;
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
    const result = await this.prisma.referral.findMany({
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
    await this.audit.record({
      actorUserId: actor.id,
      action: 'CASE_REFERRALS_VIEWED',
      resourceType: 'HELP_REQUEST',
      resourceId: id,
      outcome: 'success',
    });
    return result;
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
          latitude: null,
          longitude: null,
          locationConsentGiven: false,
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
