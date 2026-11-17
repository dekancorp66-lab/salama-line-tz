import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  districtCode: string | null;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  tokenVersion: number;
  passwordResetTokenHash: string | null;
  passwordResetExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

describe('AuthService', () => {
  let auth: AuthService;
  let storedUser: StoredUser | null;
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };
  const prismaMock = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email && storedUser?.email === where.email) return storedUser;
        if (where.id && storedUser?.id === where.id) return storedUser;
        return null;
      }),
      create: jest.fn(async ({ data }: { data: any }) => {
        storedUser = {
          id: 'user-1',
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: data.displayName,
          role: UserRole.RESPONDER,
          districtCode: null,
          isActive: data.isActive,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          tokenVersion: 0,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return storedUser;
      }),
      update: jest.fn(async ({ data }: { data: any }) => {
        if (!storedUser) throw new Error('No stored user');
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in value) {
            (storedUser as any)[key] = ((storedUser as any)[key] || 0) + (value as any).increment;
          } else {
            (storedUser as any)[key] = value;
          }
        }
        return storedUser;
      }),
    },
  };
  const jwtMock = { signAsync: jest.fn().mockResolvedValue('access-token') };

  beforeEach(async () => {
    storedUser = null;
    jest.clearAllMocks();
    delete process.env.LOGIN_MAX_ATTEMPTS;
    delete process.env.LOGIN_LOCK_MINUTES;
    delete process.env.PASSWORD_RESET_TTL_MINUTES;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    auth = moduleRef.get(AuthService);
  });

  async function registerActiveResponder() {
    await auth.register({
      email: 'responder@example.org',
      password: 'A-long-password-123!',
      displayName: 'Amani Juma',
    });
    if (!storedUser) throw new Error('Registration did not persist a user');
    storedUser.isActive = true;
  }

  it('registers new responders as inactive and audits the action', async () => {
    const result = await auth.register({
      email: 'Responder@example.org',
      password: 'A-long-password-123!',
      displayName: '  Amani Juma  ',
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'responder@example.org',
          displayName: 'Amani Juma',
          isActive: false,
        }),
      }),
    );
    expect(result.user).toMatchObject({ role: UserRole.RESPONDER, isActive: false });
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_REGISTER', outcome: 'success' }),
    );
  });

  it('rejects login until activation and binds the token to the current token version', async () => {
    await auth.register({
      email: 'responder@example.org',
      password: 'A-long-password-123!',
      displayName: 'Amani Juma',
    });

    await expect(
      auth.login({ email: 'responder@example.org', password: 'A-long-password-123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtMock.signAsync).not.toHaveBeenCalled();

    if (!storedUser) throw new Error('Registration did not persist a user');
    storedUser.isActive = true;

    await expect(
      auth.login({ email: 'responder@example.org', password: 'A-long-password-123!' }),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      user: { id: 'user-1', role: UserRole.RESPONDER },
    });
    expect(jwtMock.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      role: UserRole.RESPONDER,
      ver: 0,
    });
  });

  it(
    'locks the account after repeated failures and rejects a correct password while locked',
    async () => {
      process.env.LOGIN_MAX_ATTEMPTS = '3';
      await registerActiveResponder();

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await expect(
          auth.login({ email: 'responder@example.org', password: 'wrong-password' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }

      expect(storedUser?.failedLoginAttempts).toBe(3);
      expect(storedUser?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGIN_LOCKOUT', outcome: 'failure' }),
      );

      await expect(
        auth.login({ email: 'responder@example.org', password: 'A-long-password-123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    },
    20_000,
  );

  it('confirms a recovery token, clears lockout state, and revokes existing tokens', async () => {
    await registerActiveResponder();
    if (!storedUser) throw new Error('Registration did not persist a user');
    storedUser.failedLoginAttempts = 5;
    storedUser.lockedUntil = new Date(Date.now() + 60_000);
    const token = 'a'.repeat(64);
    storedUser.passwordResetTokenHash = createHash('sha256').update(token).digest('hex');
    storedUser.passwordResetExpiresAt = new Date(Date.now() + 60_000);

    await expect(
      auth.confirmPasswordReset({
        email: 'responder@example.org',
        token,
        newPassword: 'A-new-password-456!',
      }),
    ).resolves.toMatchObject({ message: expect.stringContaining('Password updated') });

    expect(storedUser.failedLoginAttempts).toBe(0);
    expect(storedUser.lockedUntil).toBeNull();
    expect(storedUser.tokenVersion).toBe(1);
    expect(storedUser.passwordResetTokenHash).toBeNull();
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_PASSWORD_RESET_CONFIRMED', outcome: 'success' }),
    );
  });

  it('rejects an invalid recovery token without changing the account', async () => {
    await registerActiveResponder();
    if (!storedUser) throw new Error('Registration did not persist a user');
    storedUser.passwordResetTokenHash = createHash('sha256').update('b'.repeat(64)).digest('hex');
    storedUser.passwordResetExpiresAt = new Date(Date.now() + 60_000);
    const previousHash = storedUser.passwordHash;

    await expect(
      auth.confirmPasswordReset({
        email: 'responder@example.org',
        token: 'c'.repeat(64),
        newPassword: 'A-new-password-456!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(storedUser.passwordHash).toBe(previousHash);
    expect(storedUser.tokenVersion).toBe(0);
  });
});
