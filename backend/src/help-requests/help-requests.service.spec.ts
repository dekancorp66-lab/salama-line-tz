import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ConsentDecision,
  ConsentPurpose,
  HelpRequestStatus,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { HelpRequestsService } from './help-requests.service';

describe('HelpRequestsService', () => {
  let service: HelpRequestsService;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    helpRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    caseNote: { create: jest.fn(), findMany: jest.fn() },
    caseAssignmentEvent: { create: jest.fn() },
    escalationEvent: { create: jest.fn() },
    notificationOutbox: { create: jest.fn() },
    consentRecord: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    serviceDirectoryEntry: { findUnique: jest.fn() },
    referral: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
  };

  const responder = {
    id: 'responder-1',
    role: 'RESPONDER',
    districtCode: 'MBEYA',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.CONTACT_HASH_SECRET = 'a-separate-test-hash-secret-at-least-32';
    delete process.env.CASE_RETENTION_HOURS;
    prismaMock.helpRequest.findMany.mockResolvedValue([]);
    prismaMock.helpRequest.create.mockResolvedValue({ id: 'case-1' });
    prismaMock.helpRequest.update.mockResolvedValue({ id: 'case-1' });
    prismaMock.caseAssignmentEvent.create.mockResolvedValue({ id: 'event-1' });
    prismaMock.escalationEvent.create.mockResolvedValue({ id: 'escalation-1' });
    prismaMock.notificationOutbox.create.mockResolvedValue({ id: 'outbox-1' });
    prismaMock.caseNote.create.mockResolvedValue({ id: 'note-1' });
    prismaMock.caseNote.findMany.mockResolvedValue([]);
    prismaMock.consentRecord.findMany.mockResolvedValue([]);
    prismaMock.consentRecord.findFirst.mockResolvedValue(null);
    prismaMock.consentRecord.create.mockResolvedValue({ id: 'consent-1' });
    prismaMock.consentRecord.update.mockResolvedValue({ id: 'consent-1' });
    prismaMock.referral.create.mockResolvedValue({ id: 'referral-1' });
    prismaMock.referral.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
    auditMock.record.mockResolvedValue(undefined);
    service = new HelpRequestsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  function accessRecord(over: Record<string, unknown> = {}) {
    return {
      id: 'case-1',
      districtCode: 'MBEYA',
      assignedResponderId: null,
      status: HelpRequestStatus.PENDING,
      escalationCount: 0,
      ...over,
    };
  }

  describe('district and assignment authorization', () => {
    it('returns no cases to a responder without a district and never queries all districts', async () => {
      await expect(service.listForStaff(undefined, false)).resolves.toEqual([]);
      expect(prismaMock.helpRequest.findMany).not.toHaveBeenCalled();
    });

    it('scopes responder queries to the assigned district and only open states', async () => {
      await service.listForStaff('mbeya', false);
      expect(prismaMock.helpRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            districtCode: 'MBEYA',
            status: { in: expect.not.arrayContaining([HelpRequestStatus.RESOLVED]) },
          }),
        }),
      );
      const statuses = prismaMock.helpRequest.findMany.mock.calls[0][0].where.status.in;
      expect(statuses).not.toContain(HelpRequestStatus.CLOSED);
      expect(statuses).not.toContain(HelpRequestStatus.CANCELLED);
      expect(statuses).not.toContain(HelpRequestStatus.EXPIRED);
      expect(statuses).not.toContain(HelpRequestStatus.RESOLVED);
    });

    it('allows an explicit administrator query across districts', async () => {
      await service.listForStaff(undefined, true);
      const call = prismaMock.helpRequest.findMany.mock.calls[0][0];
      expect(call.where.districtCode).toBeUndefined();
    });

    it('rejects a responder without a district from changing any case', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      await expect(
        service.updateStatus('case-1', HelpRequestStatus.ACCEPTED, {
          id: 'responder-1',
          role: 'RESPONDER',
          districtCode: null,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.helpRequest.update).not.toHaveBeenCalled();
    });

    it('rejects a responder from another district', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      await expect(
        service.updateStatus('case-1', HelpRequestStatus.ACCEPTED, {
          id: 'responder-1',
          role: 'RESPONDER',
          districtCode: 'DAR',
        }),
      ).rejects.toThrow(/outside your authorized district/);
      expect(prismaMock.helpRequest.update).not.toHaveBeenCalled();
    });

    it('rejects a responder trying to change a case assigned to someone else', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(
        accessRecord({
          assignedResponderId: 'responder-2',
          status: HelpRequestStatus.ASSIGNED,
        }),
      );
      await expect(
        service.updateStatus('case-1', HelpRequestStatus.IN_PROGRESS, responder),
      ).rejects.toThrow(/assigned to another responder/);
      expect(prismaMock.helpRequest.update).not.toHaveBeenCalled();
    });

    it('denies cross-district access on the single-case view', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      await expect(
        service.getCase('case-1', { id: 'responder-1', role: 'RESPONDER', districtCode: 'DAR' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('intake and redaction', () => {
    it('rejects anonymous reports that include contact details', async () => {
      await expect(
        service.create({
          topic: 'school concern',
          districtCode: 'MBEYA',
          channel: 'WEB',
          consentToContact: true,
          contact: '0712345678',
          anonymousReport: true,
        }),
      ).rejects.toThrow(/Anonymous reports must not include contact details/);
      expect(prismaMock.helpRequest.create).not.toHaveBeenCalled();
    });

    it('redacts identifying details from concern text before persistence', async () => {
      await service.create({
        topic: 'school concern',
        districtCode: 'MBEYA',
        channel: 'WEB',
        consentToContact: false,
        concernSummary:
          'My name is Amina Juma. Call 0712345678 or email amina@example.com about school fees.',
      });
      const data = prismaMock.helpRequest.create.mock.calls[0][0].data;
      expect(data.concernSummary).not.toMatch(/Amina|0712345678|amina@example\.com/);
      expect(data.concernSummary).toContain('[contact removed]');
    });

    it('redacts contact patterns from staff notes and rejects empty results', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      await service.addNote('case-1', { note: 'Call 0712345678 for update' }, responder);
      const note = prismaMock.caseNote.create.mock.calls[0][0].data.note;
      expect(note).not.toMatch(/0712345678/);
      expect(note).toContain('[contact removed]');

      await expect(
        service.addNote('case-1', { note: '0712345678' }, responder),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('lifecycle', () => {
    it('assigns an accepted case to the responder and writes an audit event', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      prismaMock.helpRequest.update.mockResolvedValue({
        id: 'case-1',
        caseCode: 'SL-ABCDEF12',
        status: HelpRequestStatus.ACCEPTED,
        assignedResponderId: 'responder-1',
      });

      await expect(
        service.updateStatus('case-1', HelpRequestStatus.ACCEPTED, {
          id: 'responder-1',
          role: 'RESPONDER',
          districtCode: 'mbeya',
        }),
      ).resolves.toMatchObject({ assignedResponderId: 'responder-1' });

      const update = prismaMock.helpRequest.update.mock.calls[0][0];
      expect(update.data.assignedResponderId).toBe('responder-1');
      expect(update.data.acceptedAt).toBeInstanceOf(Date);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HELP_REQUEST_STATUS_UPDATED',
          resourceType: 'HELP_REQUEST',
          resourceId: 'case-1',
        }),
      );
    });

    it('rejects an illegal transition', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(
        accessRecord({ status: HelpRequestStatus.CLOSED, assignedResponderId: 'responder-1' }),
      );
      await expect(
        service.updateStatus('case-1', HelpRequestStatus.IN_PROGRESS, responder),
      ).rejects.toThrow(/Illegal case transition/);
      expect(prismaMock.helpRequest.update).not.toHaveBeenCalled();
    });

    it('returns a minimized single-case view without contact identifiers', async () => {
      prismaMock.helpRequest.findUnique
        .mockResolvedValueOnce(accessRecord())
        .mockResolvedValueOnce({
          id: 'case-1',
          caseCode: 'SL-ABCDEF12',
          topic: 'school concern',
          status: HelpRequestStatus.PENDING,
          consents: [],
          notes: [],
        });
      const result = await service.getCase('case-1', responder);
      expect(result).not.toHaveProperty('contactHash');
      expect(result).not.toHaveProperty('contactCiphertext');
      expect(result).not.toHaveProperty('contact');
    });

    it('assigns a case to a verified active responder of the same district', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'responder-9',
        role: UserRole.RESPONDER,
        districtCode: 'MBEYA',
        isActive: true,
      });
      await service.assign(
        'case-1',
        { responderId: 'responder-9', reason: 'duty roster' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const update = prismaMock.helpRequest.update.mock.calls[0][0];
      expect(update.data.status).toBe(HelpRequestStatus.ASSIGNED);
      expect(update.data.assignedResponderId).toBe('responder-9');
      expect(prismaMock.caseAssignmentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ toResponderId: 'responder-9' }),
        }),
      );
    });

    it('refuses to assign to an inactive account or a responder from another district', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'responder-9',
        role: UserRole.RESPONDER,
        districtCode: 'DAR',
        isActive: true,
      });
      await expect(
        service.assign('case-1', { responderId: 'responder-9' }, { id: 'admin-1', role: 'ADMIN' }),
      ).rejects.toThrow(/not assigned to this case district/);
      expect(prismaMock.helpRequest.update).not.toHaveBeenCalled();
    });

    it('records an escalation without any destination or automatic contact', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(
        accessRecord({
          status: HelpRequestStatus.ASSIGNED,
          assignedResponderId: 'responder-1',
          escalationCount: 1,
        }),
      );
      await service.escalate('case-1', { reason: 'no reply' }, responder);
      expect(prismaMock.escalationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ escalationCount: 2 }),
        }),
      );
      const outbox = prismaMock.notificationOutbox.create.mock.calls[0][0].data;
      expect(outbox.destinationHash).toBeNull();
      expect(outbox).not.toHaveProperty('to');
      expect(outbox).not.toHaveProperty('body');
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_ESCALATED' }),
      );
    });
  });

  describe('consent and referrals', () => {
    it('records a specific versioned consent grant', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      await service.grantConsent(
        'case-1',
        { purpose: ConsentPurpose.SHARE_WITH_SERVICE, wordingVersion: 'salama-consent-v2' },
        responder,
      );
      expect(prismaMock.consentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purpose: ConsentPurpose.SHARE_WITH_SERVICE,
            decision: ConsentDecision.GRANTED,
            wordingVersion: 'salama-consent-v2',
          }),
        }),
      );
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_CONSENT_GRANTED' }),
      );
    });

    it('revokes contact consent in place, appends a revocation record, and wipes contact', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      prismaMock.consentRecord.findMany.mockResolvedValue([{ id: 'consent-1' }]);
      await service.revokeConsent(
        'case-1',
        { purpose: ConsentPurpose.CONTACT_FOR_HELP },
        responder,
      );
      expect(prismaMock.consentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'consent-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(prismaMock.consentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ decision: ConsentDecision.REVOKED }),
        }),
      );
      const helpUpdate = prismaMock.helpRequest.update.mock.calls.find(
        ([call]: any[]) => call?.data?.consentToContact === false,
      );
      expect(helpUpdate?.[0].data.contactHash).toBeNull();
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_CONSENT_REVOKED' }),
      );
    });

    it('refuses to revoke consent that is not active', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      prismaMock.consentRecord.findMany.mockResolvedValue([]);
      await expect(
        service.revokeConsent('case-1', { purpose: ConsentPurpose.FOLLOW_UP }, responder),
      ).rejects.toThrow(/no active consent/);
    });

    it('creates a referral only with active consent and an active verified service', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      prismaMock.serviceDirectoryEntry.findUnique.mockResolvedValue({
        id: 'service-1',
        isActive: true,
        expiresAt: null,
      });
      prismaMock.consentRecord.findFirst.mockResolvedValue({ id: 'consent-1' });
      await service.createReferral('case-1', { serviceEntryId: 'service-1' }, responder);
      expect(prismaMock.consentRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ purpose: ConsentPurpose.SHARE_WITH_SERVICE }),
        }),
      );
      expect(prismaMock.referral.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ serviceEntryId: 'service-1', consentGranted: true }),
        }),
      );
    });

    it('rejects a referral when no consent permits sharing', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      prismaMock.serviceDirectoryEntry.findUnique.mockResolvedValue({
        id: 'service-1',
        isActive: true,
        expiresAt: null,
      });
      prismaMock.consentRecord.findFirst.mockResolvedValue(null);
      await expect(
        service.createReferral('case-1', { serviceEntryId: 'service-1' }, responder),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.referral.create).not.toHaveBeenCalled();
    });

    it('rejects a referral to an expired or inactive service', async () => {
      prismaMock.helpRequest.findUnique.mockResolvedValue(accessRecord());
      prismaMock.serviceDirectoryEntry.findUnique.mockResolvedValue({
        id: 'service-1',
        isActive: false,
        expiresAt: null,
      });
      await expect(
        service.createReferral('case-1', { serviceEntryId: 'service-1' }, responder),
      ).rejects.toThrow(/active verified service/);
    });
  });

  describe('retention', () => {
    it('expires old open cases and wipes contact details without contacting anyone', async () => {
      process.env.CASE_RETENTION_HOURS = '168';
      prismaMock.helpRequest.findMany.mockResolvedValue([{ id: 'old-1' }]);
      await expect(service.sweepExpired()).resolves.toEqual({ expired: 1 });
      const update = prismaMock.helpRequest.update.mock.calls[0][0];
      expect(update.data.status).toBe(HelpRequestStatus.EXPIRED);
      expect(update.data.contactHash).toBeNull();
      expect(update.data.contactCiphertext).toBeNull();
      expect(update.data.concernSummary).toBeNull();
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CASE_EXPIRED_RETENTION' }),
      );
      expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
    });
  });
});
