import { UserRole } from '@prisma/client';
import {
  BootstrapError,
  SuperAdminBootstrapService,
} from './super-admin-bootstrap.service';

const OWNER_EMAIL = 'wilbardmagaso777@gmail.com';
const OWNER_ID = 'cmwl0qwa50000y9m0kyd7niry';

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  tokenVersion: number;
  failedLoginAttempts: number;
}

describe('SuperAdminBootstrapService', () => {
  let users: MockUser[];
  let auditEvents: any[];
  let prisma: any;
  let service: SuperAdminBootstrapService;

  const makeUser = (overrides: Partial<MockUser> = {}): MockUser => ({
    id: OWNER_ID,
    email: OWNER_EMAIL,
    passwordHash: '$2b$12$existing-owner-hash-value-0000000000000000000000000000',
    role: UserRole.RESPONDER,
    isActive: false,
    tokenVersion: 0,
    failedLoginAttempts: 1,
    ...overrides,
  });

  beforeEach(() => {
    users = [makeUser()];
    auditEvents = [];
    prisma = {
      user: {
        findUnique: jest.fn(async ({ where }: any) =>
          users.find((u) => u.email === where.email || u.id === where.id) ?? null,
        ),
        findFirst: jest.fn(async ({ where }: any) => {
          const others = users.filter((u) => u.role === UserRole.SUPER_ADMIN);
          return others.find((u) => where.NOT?.id !== u.id) ?? null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const user = users.find((u) => u.id === where.id);
          if (!user) throw new Error('not found');
          Object.assign(user, data);
          return user;
        }),
      },
      auditEvent: {
        create: jest.fn(async ({ data }: any) => {
          auditEvents.push(data);
          return data;
        }),
      },
    };
    service = new SuperAdminBootstrapService(prisma);
  });

  it('promotes the existing account in place, preserving id and password hash', async () => {
    const before = { ...users[0] };

    const result = await service.run({ email: OWNER_EMAIL, expectedUserId: OWNER_ID });

    expect(result).toEqual({
      id: OWNER_ID,
      email: OWNER_EMAIL,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      changed: true,
    });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: OWNER_ID },
      data: { role: UserRole.SUPER_ADMIN, isActive: true },
    });
    expect(users[0]).toMatchObject({
      id: before.id,
      passwordHash: before.passwordHash,
      tokenVersion: before.tokenVersion,
      failedLoginAttempts: before.failedLoginAttempts,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        action: 'SUPER_ADMIN_BOOTSTRAPPED',
        outcome: 'promoted',
        resourceId: OWNER_ID,
      }),
    ]);
  });

  it('is idempotent: an already-active Super Admin is left untouched', async () => {
    users[0].role = UserRole.SUPER_ADMIN;
    users[0].isActive = true;

    const result = await service.run({ email: OWNER_EMAIL, expectedUserId: OWNER_ID });

    expect(result.changed).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('refuses to overwrite an existing, different Super Admin', async () => {
    users.push(makeUser({ id: 'other-super-id', email: 'other@example.org', role: UserRole.SUPER_ADMIN }));

    await expect(
      service.run({ email: OWNER_EMAIL, expectedUserId: OWNER_ID }),
    ).rejects.toBeInstanceOf(BootstrapError);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(users[0]).toMatchObject({ role: UserRole.RESPONDER, isActive: false });
  });

  it('refuses when the target account does not exist', async () => {
    users = [];

    await expect(service.run({ email: OWNER_EMAIL })).rejects.toBeInstanceOf(BootstrapError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses when the supplied account id does not match the target', async () => {
    await expect(
      service.run({ email: OWNER_EMAIL, expectedUserId: 'a-different-id' }),
    ).rejects.toBeInstanceOf(BootstrapError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an email outside the owner allowlist', async () => {
    await expect(service.run({ email: 'attacker@example.org' })).rejects.toBeInstanceOf(
      BootstrapError,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('never logs a password hash or secret', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.run({ email: OWNER_EMAIL, expectedUserId: OWNER_ID });

    const output = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(' ');
    expect(output).not.toContain(users[0].passwordHash);
    expect(output).not.toMatch(/\$2[aby]\$/);
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
