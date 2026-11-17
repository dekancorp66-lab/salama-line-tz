import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy token version enforcement', () => {
  const user = {
    id: 'user-1',
    email: 'responder@example.org',
    role: UserRole.RESPONDER,
    districtCode: 'MBEYA',
    isActive: true,
    tokenVersion: 2,
  };
  const jwtMock = {
    verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', role: UserRole.RESPONDER, ver: 2 }),
  };
  const prismaMock = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
  };
  const strategy = new JwtStrategy(jwtMock as unknown as JwtService, prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    jwtMock.verifyAsync.mockResolvedValue({ sub: 'user-1', role: UserRole.RESPONDER, ver: 2 });
    prismaMock.user.findUnique.mockResolvedValue(user);
  });

  it('accepts a token whose version matches the account', async () => {
    await expect(strategy.authenticate('Bearer token')).resolves.toMatchObject({
      id: 'user-1',
      districtCode: 'MBEYA',
    });
  });

  it('rejects an older token after a password reset or access change', async () => {
    jwtMock.verifyAsync.mockResolvedValue({ sub: 'user-1', role: UserRole.RESPONDER, ver: 1 });
    await expect(strategy.authenticate('Bearer old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token for a deactivated account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    await expect(strategy.authenticate('Bearer token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
