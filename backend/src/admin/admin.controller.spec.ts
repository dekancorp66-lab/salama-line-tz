import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { AdminController } from './admin.controller';

describe('AdminController user access', () => {
  let app: INestApplication;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        email: 'responder@example.org',
        role: UserRole.RESPONDER,
        isActive: true,
      }),
      update: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'responder@example.org',
        displayName: 'userName',
        role: UserRole.RESPONDER,
        districtCode: null,
        isActive: true,
      }),
    },
  };
  const strategyMock = {
    authenticate: jest.fn(async (authorization?: string) => {
      if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
      const token = authorization.slice(7);
      const isAdmin = token === 'super-admin-token' || token === 'ordinary-admin-token';
      return {
        id: 'admin-1',
        email: token === 'super-admin-token' ? 'wilbardmagaso777@gmail.com' : 'admin@example.org',
        role: isAdmin ? UserRole.ADMIN : UserRole.RESPONDER,
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
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      email: 'responder@example.org',
      role: UserRole.RESPONDER,
      isActive: true,
    });
  });

  it('rejects requests without an authenticated user', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .send({ isActive: true })
      .expect(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects authenticated non-administrators', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer responder-token')
      .send({ isActive: true })
      .expect(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('allows an administrator to activate a user using the documented request body', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer ordinary-admin-token')
      .send({ isActive: true })
      .expect(200)
      .expect({
        id: 'user-1',
        email: 'responder@example.org',
        displayName: 'userName',
        role: UserRole.RESPONDER,
        districtCode: null,
        isActive: true,
      });

    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: { isActive: true },
    }));
    expect(auditMock.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ADMIN_USER_ACCESS_UPDATED',
      outcome: 'success',
    }));
  });

  it('allows only the super administrator to grant administrator access', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer ordinary-admin-token')
      .send({ isActive: true, role: UserRole.ADMIN })
      .expect(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer super-admin-token')
      .send({ isActive: true, role: UserRole.ADMIN })
      .expect(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { isActive: true, role: UserRole.ADMIN, tokenVersion: { increment: 1 } },
    }));
  });

  it('prevents other administrators from changing administrator accounts', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      email: 'wilbardmagaso777@gmail.com',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    });

    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer ordinary-admin-token')
      .send({ isActive: false })
      .expect(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('prevents the super administrator from deactivating or downgrading its own account', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      email: 'wilbardmagaso777@gmail.com',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    });

    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/user-1/access')
      .set('Authorization', 'Bearer super-admin-token')
      .send({ isActive: false })
      .expect(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('publishes the access request schema in Swagger', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('SalamaLine API').setVersion('1.0.0').addBearerAuth().build(),
    );
    const operation = document.paths['/api/v1/admin/users/{id}/access']?.patch;

    expect(operation?.requestBody).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateUserAccessDto' },
        },
      },
    });
    expect(document.components?.schemas?.UpdateUserAccessDto).toMatchObject({
      required: ['isActive'],
      properties: {
        isActive: { type: 'boolean' },
        role: { type: 'string', enum: Object.values(UserRole) },
        districtCode: { type: 'string', maxLength: 20 },
      },
    });
  });
});
