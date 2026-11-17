import { Test } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { HelpRequestStatus, UserRole } from '@prisma/client';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../database/prisma.service';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsService } from './help-requests.service';

describe('HelpRequestsController Phase 4 routes', () => {
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
  const strategyMock = {
    authenticate: jest.fn(async (authorization?: string) => {
      if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
      const users: Record<string, { id: string; role: UserRole; districtCode: string }> = {
        'admin-token': { id: 'admin-1', role: UserRole.ADMIN, districtCode: '' },
        'mbeya-token': { id: 'responder-1', role: UserRole.RESPONDER, districtCode: 'MBEYA' },
        'dar-token': { id: 'responder-2', role: UserRole.RESPONDER, districtCode: 'DAR' },
      };
      const user = users[authorization.slice(7)];
      if (!user) throw new UnauthorizedException();
      return user;
    }),
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
    prismaMock.helpRequest.findMany.mockResolvedValue([]);
    prismaMock.helpRequest.create.mockResolvedValue({
      id: 'case-1',
      caseCode: 'SL-ABCDEF12',
    });
    prismaMock.helpRequest.update.mockResolvedValue({ id: 'case-1' });
    prismaMock.helpRequest.findUnique.mockResolvedValue({
      id: 'case-1',
      districtCode: 'MBEYA',
      assignedResponderId: null,
      status: HelpRequestStatus.PENDING,
      escalationCount: 0,
    });
    prismaMock.caseNote.create.mockResolvedValue({ id: 'note-1' });
    prismaMock.consentRecord.findMany.mockResolvedValue([]);
    prismaMock.consentRecord.findFirst.mockResolvedValue(null);
    prismaMock.consentRecord.create.mockResolvedValue({ id: 'consent-1' });
    prismaMock.consentRecord.update.mockResolvedValue({ id: 'consent-1' });
    prismaMock.serviceDirectoryEntry.findUnique.mockResolvedValue({
      id: 'service-1',
      isActive: true,
      expiresAt: null,
    });
    prismaMock.referral.create.mockResolvedValue({ id: 'referral-1' });
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  });

  it('accepts public intake and redacts concern text', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/help-requests')
      .send({
        topic: 'school concern',
        districtCode: 'mbeya',
        channel: 'WEB',
        consentToContact: false,
        concernSummary: 'Reach me on 0712345678 about my daughter Amina.',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.caseCode).toBe('SL-ABCDEF12');
        expect(body).not.toHaveProperty('contactHash');
        expect(body).not.toHaveProperty('contactCiphertext');
      });
    const data = prismaMock.helpRequest.create.mock.calls[0][0].data;
    expect(data.concernSummary).not.toMatch(/0712345678|Amina/);
  });

  it('rejects unauthenticated case access', async () => {
    await request(app.getHttpServer()).get('/api/v1/help-requests').expect(401);
    await request(app.getHttpServer()).get('/api/v1/help-requests/case-1').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/help-requests/case-1/escalate')
      .send({})
      .expect(401);
  });

  it('scopes the list query to the responders district', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/help-requests')
      .set('Authorization', 'Bearer mbeya-token')
      .expect(200);
    const call = prismaMock.helpRequest.findMany.mock.calls[0][0];
    expect(call.where.districtCode).toBe('MBEYA');
  });

  it('denies cross-district access on the single-case endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/help-requests/case-1')
      .set('Authorization', 'Bearer dar-token')
      .expect(403);
  });

  it('redacts contact details in notes and denies other districts', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/help-requests/case-1/notes')
      .set('Authorization', 'Bearer dar-token')
      .send({ note: 'follow up scheduled' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/help-requests/case-1/notes')
      .set('Authorization', 'Bearer mbeya-token')
      .send({ note: 'call 0712345678 tomorrow' })
      .expect(201);
    const data = prismaMock.caseNote.create.mock.calls[0][0].data;
    expect(data.note).not.toMatch(/0712345678/);
  });

  it('requires authentication and district authorization for consent changes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/help-requests/case-1/consent/grant')
      .send({ purpose: 'SHARE_WITH_SERVICE' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/help-requests/case-1/consent/grant')
      .set('Authorization', 'Bearer dar-token')
      .send({ purpose: 'SHARE_WITH_SERVICE' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/help-requests/case-1/consent/grant')
      .set('Authorization', 'Bearer mbeya-token')
      .send({ purpose: 'SHARE_WITH_SERVICE', wordingVersion: 'salama-consent-v2' })
      .expect(201);
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CASE_CONSENT_GRANTED' }),
    );
  });

  it('requires SHARE_WITH_SERVICE consent before creating a referral', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/help-requests/case-1/referrals')
      .set('Authorization', 'Bearer mbeya-token')
      .send({ serviceEntryId: 'service-1' })
      .expect(403);
    expect(prismaMock.referral.create).not.toHaveBeenCalled();
  });

  it('restricts the retention sweep to administrators', async () => {
    prismaMock.helpRequest.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .post('/api/v1/help-requests/retention/sweep')
      .set('Authorization', 'Bearer mbeya-token')
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/help-requests/retention/sweep')
      .set('Authorization', 'Bearer admin-token')
      .expect(201)
      .expect(({ body }) => expect(body).toEqual({ expired: 0 }));
  });

  it('records escalations with a metadata-only outbox entry', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/help-requests/case-1/escalate')
      .set('Authorization', 'Bearer mbeya-token')
      .send({ reason: 'no response after two alerts' })
      .expect(201);
    const outbox = prismaMock.notificationOutbox.create.mock.calls[0][0].data;
    expect(outbox.destinationHash).toBeNull();
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CASE_ESCALATED' }),
    );
  });
});
