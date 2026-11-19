import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HelpRequestStatus, UserRole } from '@prisma/client';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../database/prisma.service';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsService } from './help-requests.service';

interface TokenUser {
  id: string;
  role: UserRole;
  districtCode: string;
  institutionId: string | null;
}

/** Server-side institution isolation is enforced here, not by hiding UI. */
describe('Institution case isolation', () => {
  let app: INestApplication;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    helpRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    institution: { findUnique: jest.fn() },
    caseNote: { create: jest.fn(), findMany: jest.fn() },
    caseAssignmentEvent: { create: jest.fn() },
    escalationEvent: { create: jest.fn() },
    notificationOutbox: { create: jest.fn() },
    consentRecord: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    serviceDirectoryEntry: { findUnique: jest.fn() },
    referral: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
  };

  const tokenUsers: Record<string, TokenUser> = {
    'officer-a-token': {
      id: 'officer-a',
      role: UserRole.RESPONDER,
      districtCode: 'MBEYA',
      institutionId: 'inst-a',
    },
    'officer-b-token': {
      id: 'officer-b',
      role: UserRole.RESPONDER,
      districtCode: 'MBEYA',
      institutionId: 'inst-b',
    },
    'legacy-officer-token': {
      id: 'legacy-officer',
      role: UserRole.RESPONDER,
      districtCode: 'MBEYA',
      institutionId: null,
    },
    'admin-a-token': {
      id: 'admin-a',
      role: UserRole.ADMIN,
      districtCode: 'MBEYA',
      institutionId: 'inst-a',
    },
    'super-token': {
      id: 'super-1',
      role: UserRole.SUPER_ADMIN,
      districtCode: '',
      institutionId: null,
    },
  };

  const strategyMock = {
    authenticate: jest.fn(async (authorization?: string) => {
      if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
      const user = tokenUsers[authorization.slice(7)];
      if (!user) throw new UnauthorizedException();
      return user;
    }),
  };

  const assignedCase = {
    id: 'case-1',
    caseCode: 'SL-ABCDEF12',
    districtCode: 'MBEYA',
    assignedResponderId: null,
    institutionId: 'inst-a',
    status: HelpRequestStatus.PENDING,
    escalationCount: 0,
    createdAt: new Date(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HelpRequestsController],
      providers: [
        HelpRequestsService,
        JwtAuthGuard,
        RolesGuard,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        { provide: JwtStrategy, useValue: strategyMock },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTACT_HASH_SECRET = 'a-separate-test-hash-secret-at-least-32';
    prismaMock.helpRequest.findUnique.mockResolvedValue({ ...assignedCase });
    prismaMock.helpRequest.findMany.mockResolvedValue([]);
    prismaMock.helpRequest.update.mockResolvedValue({ id: 'case-1' });
    prismaMock.institution.findUnique.mockResolvedValue({ id: 'inst-b', isActive: true });
    prismaMock.caseNote.findMany.mockResolvedValue([]);
    prismaMock.referral.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  });

  it('denies an officer from another institution even in the same district', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/help-requests/case-1')
      .set('Authorization', 'Bearer officer-b-token')
      .expect(403);
    expect(prismaMock.helpRequest.findMany).not.toHaveBeenCalled();
  });

  it('allows an officer from the assigned institution and audits the case view', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/help-requests/case-1')
      .set('Authorization', 'Bearer officer-a-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body).not.toHaveProperty('contactHash');
        expect(body).not.toHaveProperty('contactCiphertext');
      });
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CASE_VIEWED',
        resourceType: 'HELP_REQUEST',
        resourceId: 'case-1',
      }),
    );
  });

  it('hides unassigned cases from institution officers', async () => {
    prismaMock.helpRequest.findUnique.mockResolvedValue({ ...assignedCase, institutionId: null });
    await request(app.getHttpServer())
      .get('/api/v1/help-requests/case-1')
      .set('Authorization', 'Bearer officer-a-token')
      .expect(403);
  });

  it('scopes the case queue query to the caller institution', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/help-requests')
      .set('Authorization', 'Bearer officer-a-token')
      .expect(200);
    expect(prismaMock.helpRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ institutionId: 'inst-a' }),
      }),
    );
    const where = prismaMock.helpRequest.findMany.mock.calls[0][0].where;
    // District compatibility filtering is applied in-memory (legacy/canonical codes).
    expect(where.districtCode).toBeUndefined();
  });

  it('confines unscoped accounts to legacy unassigned cases', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/help-requests')
      .set('Authorization', 'Bearer legacy-officer-token')
      .expect(200);
    const where = prismaMock.helpRequest.findMany.mock.calls[0][0].where;
    expect(where.institutionId).toBeNull();
    expect(where.districtCode).toBeUndefined();
  });

  it('lets a legacy unscoped officer view a legacy unassigned case', async () => {
    prismaMock.helpRequest.findUnique.mockResolvedValue({ ...assignedCase, institutionId: null });
    await request(app.getHttpServer())
      .get('/api/v1/help-requests/case-1')
      .set('Authorization', 'Bearer legacy-officer-token')
      .expect(200);
  });

  it('denies a legacy unscoped officer access to an institution case', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/help-requests/case-1')
      .set('Authorization', 'Bearer legacy-officer-token')
      .expect(403);
  });

  it('allows Super Admin cross-institution access and records an auditable event', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/help-requests/case-1')
      .set('Authorization', 'Bearer super-token')
      .expect(200);
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CASE_ACCESSED_BY_SUPER_ADMIN',
        resourceId: 'case-1',
      }),
    );
  });

  it('denies unauthenticated case access', async () => {
    await request(app.getHttpServer()).get('/api/v1/help-requests/case-1').expect(401);
  });

  it('denies a non-super administrator assigning a case to an institution', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/help-requests/case-1/institution')
      .set('Authorization', 'Bearer admin-a-token')
      .send({ institutionId: 'inst-b' })
      .expect(403);
    expect(prismaMock.helpRequest.update).not.toHaveBeenCalled();
  });

  it('lets a Super Admin explicitly assign an institution and audits it', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/help-requests/case-1/institution')
      .set('Authorization', 'Bearer super-token')
      .send({ institutionId: 'inst-b' })
      .expect(200);
    expect(prismaMock.helpRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { institutionId: 'inst-b' } }),
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CASE_INSTITUTION_ASSIGNED' }),
    );
  });

  it('rejects an inactive institution as an assignment target', async () => {
    prismaMock.institution.findUnique.mockResolvedValue({ id: 'inst-b', isActive: false });
    await request(app.getHttpServer())
      .patch('/api/v1/help-requests/case-1/institution')
      .set('Authorization', 'Bearer super-token')
      .send({ institutionId: 'inst-b' })
      .expect(400);
    expect(prismaMock.helpRequest.update).not.toHaveBeenCalled();
  });
});
