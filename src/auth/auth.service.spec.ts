import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService account activation', () => {
  let auth: AuthService;
  let storedUser: User | null;
  const prismaMock = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email: string } }) =>
        storedUser?.email === where.email ? storedUser : null),
      create: jest.fn(async ({ data }: {
        data: { email: string; passwordHash: string; displayName: string; isActive: boolean };
      }) => {
        storedUser = {
          id: 'user-1',
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: data.displayName,
          role: UserRole.RESPONDER,
          districtCode: null,
          isActive: data.isActive,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return storedUser;
      }),
    },
  };
  const jwtMock = { signAsync: jest.fn().mockResolvedValue('access-token') };

  beforeEach(async () => {
    storedUser = null;
    prismaMock.user.findUnique.mockClear();
    prismaMock.user.create.mockClear();
    jwtMock.signAsync.mockClear();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();
    auth = moduleRef.get(AuthService);
  });

  it('registers new responders as inactive', async () => {
    const result = await auth.register({
      email: 'Responder@example.org',
      password: 'A-long-password-123!',
      displayName: '  Amani Juma  ',
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'responder@example.org',
        displayName: 'Amani Juma',
        isActive: false,
      }),
    }));
    expect(result.user).toMatchObject({ role: UserRole.RESPONDER, isActive: false });
  });

  it('rejects login until the account is activated and accepts login afterward', async () => {
    await auth.register({
      email: 'responder@example.org',
      password: 'A-long-password-123!',
      displayName: 'Amani Juma',
    });

    await expect(auth.login({
      email: 'responder@example.org',
      password: 'A-long-password-123!',
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtMock.signAsync).not.toHaveBeenCalled();

    if (!storedUser) throw new Error('Registration did not persist a user');
    storedUser.isActive = true;

    await expect(auth.login({
      email: 'responder@example.org',
      password: 'A-long-password-123!',
    })).resolves.toMatchObject({
      accessToken: 'access-token',
      user: { id: 'user-1', role: UserRole.RESPONDER },
    });
    expect(jwtMock.signAsync).toHaveBeenCalledTimes(1);
  });
});
