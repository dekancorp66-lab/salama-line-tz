import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../database/prisma.service';
import { AdminController } from './admin.controller';

describe('Institution-scoped administration', () => {
  let app: INestApplication;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    helpRequest: { count: jest.fn() },
    content: { count: jest.fn() },
    serviceDirectoryEntry: { count: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    institution: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditEvent: { findMany: jest.fn() },
  };

  const tokenUsers: Record<string, { id: string; role: UserRole; institutionId: string | null }> = {
    'admin-a-token': { id: 'admin-a', role: UserRole.ADMIN, institutionId: 'inst-a' },
    'admin-b-token': { id: 'admin-b', role: UserRole.ADMIN, institutionId: 'inst-b' },
    'unscoped-admin-token': { id: 'admin-u', role: UserRole.ADMIN, institutionId: null },
    'super-token': { id: 'super-1', role: UserRole.SUPER_ADMIN, institutionId: null },
    'user-token': { id: 'user-1', role: UserRole.USER, institutionId: 'inst-a' },
  };

  const strategyMock = {
    authenticate: jest.fn(async (authorization?: string) => {
      if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
      const user = tokenUsers[authorization.slice(7)];
      if (!user) throw new UnauthorizedException();
      return user;
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
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
    prismaMock.helpRequest.count.mockResolvedValue(12);
    prismaMock.content.count.mockResolvedValue(3);
    prismaMock.serviceDirectoryEntry.count.mockResolvedValue(4);
    prismaMock.institution.findMany.mockResolvedValue([]);
    prismaMock.institution.findUnique.mockResolvedValue(null);
    prismaMock.institution.create.mockResolvedValue({ id: 'inst-new' });
    prismaMock.user.findUnique.mockResolvedValue({
      email: 'officer@example.org',
      role: UserRole.RESPONDER,
      isActive: true,
      institutionId: 'inst-a',
    });
    prismaMock.user.update.mockResolvedValue({ id: 'user-1' });
  });

  it('scopes dashboard metrics to the administrators institution', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', 'Bearer admin-a-token')
      .expect(200);
    expect(prismaMock.helpRequest.count).toHaveBeenCalledWith({
      where: { institutionId: 'inst-a' },
    });
  });

  it('does not let an institution admin request another institutions metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/metrics?institutionId=inst-b')
      .set('Authorization', 'Bearer admin-a-token')
      .expect(200);
    expect(prismaMock.helpRequest.count).toHaveBeenCalledWith({
      where: { institutionId: 'inst-a' },
    });
  });

  it('lets a Super Admin request a specific institutions metrics and audits it', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/metrics?institutionId=inst-b')
      .set('Authorization', 'Bearer super-token')
      .expect(200);
    expect(prismaMock.helpRequest.count).toHaveBeenCalledWith({
      where: { institutionId: 'inst-b' },
    });
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'institution:inst-b' }),
    );
  });

  it('restricts the institution list to the callers own institution', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/institutions')
      .set('Authorization', 'Bearer admin-a-token')
      .expect(200);
    expect(prismaMock.institution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inst-a' } }),
    );
  });

  it('allows only a Super Admin to provision institutions', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/institutions')
      .set('Authorization', 'Bearer admin-a-token')
      .send({ name: 'New Institution', code: 'new-inst' })
      .expect(403);
    expect(prismaMock.institution.create).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post('/api/v1/admin/institutions')
      .set('Authorization', 'Bearer super-token')
      .send({ name: 'New Institution', code: 'new-inst' })
      .expect(201);
    expect(prismaMock.institution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'NEW-INST', name: 'New Institution' }),
      }),
    );
  });

  it('denies a non-administrator attempting to change institution access', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer user-token')
      .send({ isActive: true, institutionId: 'inst-b' })
      .expect(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('denies an ordinary administrator assigning an institution', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer admin-a-token')
      .send({ isActive: true, institutionId: 'inst-b' })
      .expect(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('scopes the user list to the administrators institution', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer admin-a-token')
      .expect(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { institutionId: 'inst-a' } }),
    );
  });

  it('fails closed for an unscoped administrator listing users', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer unscoped-admin-token')
      .expect(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { institutionId: '__none__' } }),
    );
  });

  it('lets a Super Admin list users across institutions', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer super-token')
      .expect(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('scopes the responder list to the administrators institution', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/responders')
      .set('Authorization', 'Bearer admin-a-token')
      .expect(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: UserRole.RESPONDER, institutionId: 'inst-a' }),
      }),
    );
  });

  it('denies managing access of a user in another institution', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: 'other@example.org',
      role: UserRole.RESPONDER,
      isActive: true,
      institutionId: 'inst-b',
    });
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer admin-a-token')
      .send({ isActive: false })
      .expect(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('denies granting a privileged role to a user in the administrators institution', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer admin-a-token')
      .send({ isActive: true, role: UserRole.AUDITOR })
      .expect(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('fails closed for an unscoped administrator viewing metrics', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', 'Bearer unscoped-admin-token')
      .expect(200);
    expect(prismaMock.helpRequest.count).toHaveBeenCalledWith({
      where: { institutionId: null },
    });
  });

  it('scopes audit events to events by the administrators own staff', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/audit')
      .set('Authorization', 'Bearer admin-a-token')
      .expect(200);
    expect(prismaMock.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actor: { institutionId: 'inst-a' } } }),
    );
  });

  it('allows a Super Admin to read audit events system-wide', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/admin/audit')
      .set('Authorization', 'Bearer super-token')
      .expect(200);
    expect(prismaMock.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
