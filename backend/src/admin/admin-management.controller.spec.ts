import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../database/prisma.service';
import { AdminController } from './admin.controller';

describe('AdminController management APIs', () => {
  let app: INestApplication;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    responderProfile: { upsert: jest.fn() },
    serviceDirectoryEntry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    content: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    consentPolicy: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aiKnowledgeSource: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditEvent: { findMany: jest.fn() },
    helpRequest: { count: jest.fn() },
  };
  const strategyMock = {
    authenticate: jest.fn(async (authorization?: string) => {
      if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
      const token = authorization.slice(7);
      const roles: Record<string, UserRole> = {
        'admin-token': UserRole.ADMIN,
        'service-token': UserRole.SERVICE_MANAGER,
        'content-token': UserRole.CONTENT_MANAGER,
        'auditor-token': UserRole.AUDITOR,
        'responder-token': UserRole.RESPONDER,
      };
      if (!roles[token]) throw new UnauthorizedException();
      return { id: `staff-${token}`, email: 'staff@example.org', role: roles[token] };
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        JwtAuthGuard,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtStrategy, useValue: strategyMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.serviceDirectoryEntry.findUnique.mockResolvedValue({ id: 'service-1' });
    prismaMock.serviceDirectoryEntry.update.mockResolvedValue({
      id: 'service-1',
      name: 'Clinic',
      verifiedAt: new Date(),
      expiresAt: null,
      isActive: true,
    });
    prismaMock.content.findUnique.mockResolvedValue({ id: 'content-1' });
    prismaMock.content.update.mockResolvedValue({
      id: 'content-1',
      slug: 'safety',
      status: 'ARCHIVED',
      reviewedAt: new Date(),
    });
    prismaMock.aiKnowledgeSource.findUnique.mockResolvedValue({ id: 'knowledge-1' });
    prismaMock.aiKnowledgeSource.create.mockResolvedValue({
      id: 'knowledge-1',
      title: 'Article 11',
      version: 'v1',
      approved: false,
    });
    prismaMock.aiKnowledgeSource.update.mockResolvedValue({
      id: 'knowledge-1',
      title: 'Article 11',
      approved: true,
      approvedAt: new Date(),
    });
    prismaMock.user.findUnique.mockResolvedValue({ role: UserRole.RESPONDER });
    prismaMock.user.update.mockResolvedValue({ id: 'user-1' });
    prismaMock.responderProfile.upsert.mockResolvedValue({
      userId: 'user-1',
      districtCode: 'MBEYA',
      available: true,
      maxActiveCases: 10,
      updatedAt: new Date(),
    });
    prismaMock.consentPolicy.create.mockResolvedValue({
      id: 'policy-1',
      version: 'salama-consent-v2',
      wording: 'Approved versioned consent wording for contact.',
      effectiveAt: new Date(),
    });
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        actorUserId: 'staff-admin-token',
        action: 'ADMIN_USER_ACCESS_UPDATED',
        resourceType: 'USER',
        resourceId: 'user-1',
        outcome: 'success',
        createdAt: new Date(),
      },
    ]);
  });

  it('allows service managers to verify services and blocks responders', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/services/service-1/verify')
      .set('Authorization', 'Bearer responder-token')
      .send({ isActive: true })
      .expect(403);
    expect(prismaMock.serviceDirectoryEntry.update).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .patch('/api/v1/admin/services/service-1/verify')
      .set('Authorization', 'Bearer service-token')
      .send({ isActive: true })
      .expect(200);

    expect(prismaMock.serviceDirectoryEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
    );
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_SERVICE_ENTRY_VERIFIED' }),
    );
  });

  it('allows auditors to read audit events but not mutate service records', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/audit')
      .set('Authorization', 'Bearer auditor-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).not.toHaveProperty('metadata');
        expect(body[0]).not.toHaveProperty('requestId');
      });

    await request(app.getHttpServer())
      .patch('/api/v1/admin/services/service-1/verify')
      .set('Authorization', 'Bearer auditor-token')
      .send({ isActive: true })
      .expect(403);
  });

  it('allows content managers to archive content and blocks other staff roles', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/content/content-1/archive')
      .set('Authorization', 'Bearer service-token')
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/content/content-1/archive')
      .set('Authorization', 'Bearer content-token')
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('ARCHIVED'));
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_CONTENT_ARCHIVED' }),
    );
  });

  it('restricts consent policy creation to administrators', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/consent-policies')
      .set('Authorization', 'Bearer service-token')
      .send({ version: 'salama-consent-v2', wording: 'Approved versioned consent wording for contact.' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/consent-policies')
      .set('Authorization', 'Bearer admin-token')
      .send({ version: 'salama-consent-v2', wording: 'Approved versioned consent wording for contact.' })
      .expect(201)
      .expect(({ body }) => expect(body.version).toBe('salama-consent-v2'));
  });

  it('keeps AI knowledge sources unapproved until a review decision is recorded', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/ai-knowledge')
      .set('Authorization', 'Bearer responder-token')
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/ai-knowledge')
      .set('Authorization', 'Bearer content-token')
      .send({
        title: 'Constitution Article 11',
        sourceType: 'constitution',
        version: '2026-11-01',
        contentHash: 'a'.repeat(64),
      })
      .expect(201)
      .expect(({ body }) => expect(body.approved).toBe(false));

    await request(app.getHttpServer())
      .patch('/api/v1/admin/ai-knowledge/knowledge-1/approve')
      .set('Authorization', 'Bearer content-token')
      .send({ approved: true })
      .expect(200)
      .expect(({ body }) => expect(body.approved).toBe(true));
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_AI_KNOWLEDGE_APPROVAL_CHANGED',
        outcome: 'approved',
      }),
    );
  });

  it('manages responder availability only for responder accounts', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: UserRole.SERVICE_MANAGER });
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/availability')
      .set('Authorization', 'Bearer admin-token')
      .send({ available: true, districtCode: 'mbeya' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/availability')
      .set('Authorization', 'Bearer admin-token')
      .send({ available: true, districtCode: 'mbeya' })
      .expect(200);

    expect(prismaMock.responderProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ districtCode: 'MBEYA', available: true }),
      }),
    );
  });
});
