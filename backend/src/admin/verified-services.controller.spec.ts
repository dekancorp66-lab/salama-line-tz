import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { AdminController } from './admin.controller';

describe('AdminController verified services for case workers', () => {
  let app: INestApplication;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    serviceDirectoryEntry: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'service-1',
          name: 'Mbeya Women Health Clinic',
          type: 'CLINIC',
          districtCode: 'MBEYA',
          region: 'Mbeya',
          phonePublic: '0750000000',
        },
      ]),
    },
  };
  const strategyMock = {
    authenticate: jest.fn(async (authorization?: string) => {
      if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
      const token = authorization.slice(7);
      return {
        id: 'user-1',
        email: `${token}@example.org`,
        role: token === 'responder-token' ? UserRole.RESPONDER : UserRole.USER,
      };
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lets a responder read only active, unexpired verified services', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/verified-services')
      .set('Authorization', 'Bearer responder-token')
      .expect(200)
      .expect([
        {
          id: 'service-1',
          name: 'Mbeya Women Health Clinic',
          type: 'CLINIC',
          districtCode: 'MBEYA',
          region: 'Mbeya',
          phonePublic: '0750000000',
        },
      ]);

    expect(prismaMock.serviceDirectoryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
        select: expect.not.objectContaining({ verificationOrg: expect.anything() }),
      }),
    );
  });

  it('rejects users who cannot manage cases', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/verified-services')
      .set('Authorization', 'Bearer other-token')
      .expect(403);
  });
});
