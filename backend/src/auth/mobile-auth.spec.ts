import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request = require('supertest');
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

jest.mock('bcrypt', () => {
  const actual = jest.requireActual('bcrypt');
  return { ...actual, hash: (data: string) => actual.hash(data, 4) };
});

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  districtCode: string | null;
  institutionId: string | null;
  isActive: boolean;
  tokenVersion: number;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordResetTokenHash: string | null;
  passwordResetExpiresAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_REGISTRATION = {
  email: 'Parent@example.org',
  password: 'A-long-password-123!',
  displayName: 'Amani Juma',
};

describe('Mobile authentication endpoints (D1/D2)', () => {
  let service: AuthService;
  let app: INestApplication;
  let storedUser: StoredUser | null;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };

  const prismaMock = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email && storedUser?.email === where.email) return storedUser;
        if (where.id && storedUser?.id === where.id) return storedUser;
        return null;
      }),
      create: jest.fn(async ({ data, select }: { data: any; select?: Record<string, boolean> }) => {
        storedUser = {
          id: 'public-user-1',
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: data.displayName,
          // Mirrors the Prisma default for the legacy staff registration path.
          role: data.role ?? UserRole.RESPONDER,
          districtCode: null,
          institutionId: null,
          isActive: data.isActive,
          tokenVersion: 0,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        if (!select) return storedUser;
        const projected: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          if (select[key]) projected[key] = (storedUser as any)[key];
        }
        return projected;
      }),
      update: jest.fn(async ({ data }: { data: any }) => {
        if (!storedUser) throw new Error('No stored user');
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in value) {
            (storedUser as any)[key] =
              ((storedUser as any)[key] || 0) + (value as any).increment;
          } else {
            (storedUser as any)[key] = value;
          }
        }
        return storedUser;
      }),
    },
  };

  const jwtMock = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const strategyMock = {
    authenticate: jest.fn(async (authorization?: string) => {
      if (authorization !== 'Bearer valid-token') throw new UnauthorizedException();
      return {
        id: 'public-user-1',
        email: 'parent@example.org',
        role: UserRole.USER,
        districtCode: null,
        institutionId: null,
      };
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtAuthGuard,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: AuditService, useValue: auditMock },
        { provide: JwtStrategy, useValue: strategyMock },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
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
    storedUser = null;
    jest.clearAllMocks();
  });

  describe('registerPublic service', () => {
    it('creates an active, non-privileged USER account', async () => {
      const result = await service.registerPublic(VALID_REGISTRATION);

      expect(result.user).toMatchObject({
        email: 'parent@example.org',
        displayName: 'Amani Juma',
        role: UserRole.USER,
        isActive: true,
      });
      const createCall = prismaMock.user.create.mock.calls[0][0].data;
      expect(createCall.role).toBe(UserRole.USER);
      expect(createCall.isActive).toBe(true);
      expect(createCall).not.toHaveProperty('institutionId');
      expect(createCall).not.toHaveProperty('districtCode');
    });

    it('ignores a role injected by an untyped caller', async () => {
      // The HTTP DTO already rejects `role`; this guards against internal misuse.
      await service.registerPublic({
        ...VALID_REGISTRATION,
        role: UserRole.SUPER_ADMIN,
      } as any);

      expect(prismaMock.user.create.mock.calls[0][0].data.role).toBe(UserRole.USER);
      expect(storedUser?.role).toBe(UserRole.USER);
    });

    it('rejects duplicate email addresses', async () => {
      await service.registerPublic(VALID_REGISTRATION);
      await expect(service.registerPublic(VALID_REGISTRATION)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('records a public-registration audit event', async () => {
      await service.registerPublic(VALID_REGISTRATION);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_PUBLIC_REGISTER',
          resourceType: 'USER',
          outcome: 'success',
        }),
      );
    });
  });

  describe('logout service', () => {
    it('increments tokenVersion so issued tokens are rejected', async () => {
      await service.registerPublic(VALID_REGISTRATION);
      await service.logout('public-user-1');

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'public-user-1' },
          data: { tokenVersion: { increment: 1 } },
        }),
      );
      expect(storedUser?.tokenVersion).toBe(1);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGOUT', outcome: 'success' }),
      );
    });
  });

  describe('HTTP contract', () => {
    it('registers a public user through POST /auth/register/public', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register/public')
        .send(VALID_REGISTRATION)
        .expect(201);

      expect(response.body.user.role).toBe(UserRole.USER);
      expect(response.body.user.isActive).toBe(true);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects an attempt to assign a privileged role at registration', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/public')
        .send({ ...VALID_REGISTRATION, role: 'ADMIN' })
        .expect(400);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('requires a token for POST /auth/logout', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('logs out an authenticated user and revokes the token version', async () => {
      await service.registerPublic(VALID_REGISTRATION);
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .expect(201);
      expect(storedUser?.tokenVersion).toBe(1);
    });
  });
});
