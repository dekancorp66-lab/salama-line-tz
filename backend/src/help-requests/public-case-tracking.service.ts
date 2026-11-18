import { Injectable, NotFoundException } from '@nestjs/common';
import { HelpRequestStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/** Coarse, public-safe status labels. Internal states are deliberately merged. */
export type PublicCaseStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'IN_PROGRESS' | 'CLOSED';

export interface PublicProgressUpdate {
  label: string;
  at: string;
}

export interface PublicCaseTrackingResult {
  caseCode: string;
  submittedAt: string;
  status: PublicCaseStatus;
  lastUpdatedAt: string;
  progressUpdates: PublicProgressUpdate[];
  needsMoreInformation: boolean;
}

const PUBLIC_STATUS: Record<HelpRequestStatus, PublicCaseStatus> = {
  [HelpRequestStatus.NEW]: 'RECEIVED',
  [HelpRequestStatus.PENDING]: 'RECEIVED',
  [HelpRequestStatus.PENDING_REVIEW]: 'UNDER_REVIEW',
  [HelpRequestStatus.ACCEPTED]: 'UNDER_REVIEW',
  [HelpRequestStatus.ASSIGNED]: 'IN_PROGRESS',
  [HelpRequestStatus.IN_PROGRESS]: 'IN_PROGRESS',
  // Escalation and referral are internal operational states; showing them
  // would disclose internal handling, so they map to a neutral label.
  [HelpRequestStatus.ESCALATED]: 'UNDER_REVIEW',
  [HelpRequestStatus.REFERRED]: 'UNDER_REVIEW',
  [HelpRequestStatus.RESOLVED]: 'CLOSED',
  [HelpRequestStatus.CLOSED]: 'CLOSED',
  [HelpRequestStatus.CANCELLED]: 'CLOSED',
  [HelpRequestStatus.EXPIRED]: 'CLOSED',
};

/**
 * Public case tracking by the random case reference only.
 *
 * This service is intentionally allowlist-based: it selects a small set of
 * non-identifying fields. It never selects or returns contact details, the
 * redacted concern text, topic, district, internal id, staff assignments,
 * consent records, referrals, notes, escalation events, or alert timing.
 */
@Injectable()
export class PublicCaseTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async track(caseCode: string): Promise<PublicCaseTrackingResult> {
    const normalized = caseCode.trim().toUpperCase();

    const record = await this.prisma.helpRequest.findUnique({
      where: { caseCode: normalized },
      select: {
        id: true,
        caseCode: true,
        status: true,
        createdAt: true,
        acceptedAt: true,
        assignedAt: true,
        escalatedAt: true,
        resolvedAt: true,
        closedAt: true,
      },
    });
    if (!record) {
      throw new NotFoundException('Case reference not found');
    }

    // Metadata-only audit record using the internal id, never the reference
    // code or any case details.
    try {
      await this.audit.record({
        action: 'CASE_TRACKING_LOOKUP',
        resourceType: 'HELP_REQUEST',
        resourceId: record.id,
        outcome: 'success',
      });
    } catch {
      // Tracking must remain available even if audit recording is unavailable.
    }

    const progressUpdates: PublicProgressUpdate[] = [
      { label: 'Help request received', at: record.createdAt.toISOString() },
    ];
    const reviewAt = record.acceptedAt ?? record.assignedAt;
    if (reviewAt) {
      progressUpdates.push({ label: 'Case is being reviewed', at: reviewAt.toISOString() });
    }
    const closedAt = record.resolvedAt ?? record.closedAt;
    if (closedAt) {
      progressUpdates.push({ label: 'Case closed', at: closedAt.toISOString() });
    }

    // `lastAlertAt` and `expiresAt` are internal operational metadata and are
    // deliberately excluded from the "last updated" calculation.
    const timestamps = [
      record.createdAt,
      record.acceptedAt,
      record.assignedAt,
      record.escalatedAt,
      record.resolvedAt,
      record.closedAt,
    ].filter((value): value is Date => Boolean(value));
    const lastUpdatedAt = timestamps.reduce(
      (latest, current) => (current > latest ? current : latest),
      record.createdAt,
    );

    return {
      caseCode: record.caseCode,
      submittedAt: record.createdAt.toISOString(),
      status: PUBLIC_STATUS[record.status],
      lastUpdatedAt: lastUpdatedAt.toISOString(),
      progressUpdates,
      // There is no confidential "awaiting information" flag on the model;
      // derive this from the public status only, never from officer notes.
      needsMoreInformation: record.status === HelpRequestStatus.PENDING_REVIEW,
    };
  }
}
