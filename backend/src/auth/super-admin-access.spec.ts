import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request = require('supertest');
import { AdminController } from '../admin/admin.controller';
import { AuditService } from '../audit/audit.service';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

describe('Super Admin authentication and authorization', () => {
  let app: INestApplication;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    responderProfile: { upsert: jest.fn() },
    serviceDirectoryEntry: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    content: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    consentPolicy: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    aiKnowledgeSource: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditEvent: { findMany: jest.fn() },
    helpRequest: { count: jest.fn() },
  };
  const strategyMock = {
    authenticate: jest.fn(async (authorization?: string) => {
      if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
      const roles: Record<string, UserRole> = {
        'super-token': UserRole.SUPER_ADMIN,
        'admin-token': UserRole.ADMIN,
        'user-token': UserRole.USER,
      };
      const role = roles[authorization.slice(7)];
      if (!role) throw new UnauthorizedException();
      return { id: 'staff-1', email: 'staff@example.org', role };
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtStrategy, useValue: strategyMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('allows an authenticated SUPER_ADMIN to access a protected admin endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer super-token')
      .expect(200);
    expect(prismaMock.user.findMany).toHaveBeenCalled();
  });

  it('denies a regular USER on the same protected admin endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('denies unauthenticated access to the admin endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
  });
});
