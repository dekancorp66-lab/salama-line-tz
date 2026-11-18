import { NotFoundException } from '@nestjs/common';
import { HelpRequestStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { PublicCaseTrackingService } from './public-case-tracking.service';

const FORBIDDEN_KEYS = [
  'id',
  'topic',
  'districtCode',
  'channel',
  'priority',
  'contactHash',
  'contactCiphertext',
  'concernSummary',
  'assignedResponderId',
  'consentToContact',
  'escalationCount',
  'notes',
  'referrals',
  'consents',
  'authorId',
  'staff',
];

describe('PublicCaseTrackingService', () => {
  let service: PublicCaseTrackingService;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = { helpRequest: { findUnique: jest.fn() } };
  const base = {
    id: 'internal-case-id',
    caseCode: 'SL-CC723587',
    status: HelpRequestStatus.PENDING,
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    acceptedAt: null as Date | null,
    assignedAt: null as Date | null,
    escalatedAt: null as Date | null,
    resolvedAt: null as Date | null,
    closedAt: null as Date | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.helpRequest.findUnique.mockResolvedValue({ ...base });
    service = new PublicCaseTrackingService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('looks up only by normalized caseCode and selects safe fields', async () => {
    await service.track('  sl-cc723587  ');

    expect(prismaMock.helpRequest.findUnique).toHaveBeenCalledWith({
      where: { caseCode: 'SL-CC723587' },
      select: expect.objectContaining({
        caseCode: true,
        status: true,
        createdAt: true,
      }) as any,
    });
    const select = (prismaMock.helpRequest.findUnique as jest.Mock).mock.calls[0][0].select;
    expect(select).not.toHaveProperty('topic');
    expect(select).not.toHaveProperty('contactCiphertext');
    expect(select).not.toHaveProperty('contactHash');
    expect(select).not.toHaveProperty('concernSummary');
    expect(select).not.toHaveProperty('assignedResponderId');
    expect(select).not.toHaveProperty('notes');
    expect(select).not.toHaveProperty('referrals');
  });

  it('returns only the documented public fields', async () => {
    const result = await service.track(base.caseCode);

    expect(Object.keys(result).sort()).toEqual([
      'caseCode',
      'lastUpdatedAt',
      'needsMoreInformation',
      'progressUpdates',
      'status',
      'submittedAt',
    ]);
    expect(result).toEqual({
      caseCode: 'SL-CC723587',
      submittedAt: '2026-01-01T08:00:00.000Z',
      status: 'RECEIVED',
      lastUpdatedAt: '2026-01-01T08:00:00.000Z',
      progressUpdates: [{ label: 'Help request received', at: '2026-01-01T08:00:00.000Z' }],
      needsMoreInformation: false,
    });
    const serialized = JSON.stringify(result);
    for (const key of FORBIDDEN_KEYS) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain('internal-case-id');
  });

  it('maps internal escalation/referral states to a neutral public status', async () => {
    for (const status of [HelpRequestStatus.ESCALATED, HelpRequestStatus.REFERRED]) {
      prismaMock.helpRequest.findUnique.mockResolvedValueOnce({ ...base, status });
      const result = await service.track(base.caseCode);
      expect(result.status).toBe('UNDER_REVIEW');
      expect(JSON.stringify(result)).not.toMatch(/escalat|referr/i);
    }
  });

  it('derives last updated from safe timestamps and adds public progress steps', async () => {
    prismaMock.helpRequest.findUnique.mockResolvedValue({
      ...base,
      status: HelpRequestStatus.CLOSED,
      assignedAt: new Date('2026-01-02T09:00:00.000Z'),
      escalatedAt: new Date('2026-01-03T10:00:00.000Z'),
      closedAt: new Date('2026-01-04T11:00:00.000Z'),
    });

    const result = await service.track(base.caseCode);

    expect(result.lastUpdatedAt).toBe('2026-01-04T11:00:00.000Z');
    expect(result.status).toBe('CLOSED');
    expect(result.progressUpdates.map((u) => u.label)).toEqual([
      'Help request received',
      'Case is being reviewed',
      'Case closed',
    ]);
    expect(JSON.stringify(result)).not.toContain('2026-01-03T10:00:00.000Z');
  });

  it('signals that more information is needed only for public review state', async () => {
    prismaMock.helpRequest.findUnique.mockResolvedValueOnce({
      ...base,
      status: HelpRequestStatus.PENDING_REVIEW,
    });
    await expect(service.track(base.caseCode)).resolves.toMatchObject({
      needsMoreInformation: true,
    });
  });

  it('throws NotFound for an unknown reference and does not audit a lookup', async () => {
    prismaMock.helpRequest.findUnique.mockResolvedValue(null);

    await expect(service.track('SL-00000000')).rejects.toBeInstanceOf(NotFoundException);
    expect(auditMock.record).not.toHaveBeenCalled();
  });

  it('audits with the internal id only and never with case details', async () => {
    await service.track(base.caseCode);

    expect(auditMock.record).toHaveBeenCalledWith({
      action: 'CASE_TRACKING_LOOKUP',
      resourceType: 'HELP_REQUEST',
      resourceId: 'internal-case-id',
      outcome: 'success',
    });
  });
});
