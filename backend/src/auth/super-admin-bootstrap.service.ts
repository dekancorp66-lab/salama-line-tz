import { Injectable } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from '../common/super-admin';

/** Thrown only for invalid bootstrap input. Never contains a credential or hash. */
export class BootstrapError extends Error {}

export interface BootstrapSuperAdminInput {
  email: string;
  /** Optional safety pin: when supplied it must match the target account's id. */
  expectedUserId?: string;
}

export interface BootstrapSuperAdminResult {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** False when the account was already an active Super Admin (no writes performed). */
  changed: boolean;
}

/**
 * One-time, idempotent bootstrap that promotes an EXISTING owner account to
 * SUPER_ADMIN. It is intentionally promotion-only:
 *
 * - It never creates an account (public registration remains the only way to
 *   create one, and that path always produces an inactive RESPONDER).
 * - It never reads, writes, or rotates a password/hash. The account's id,
 *   passwordHash, and all other fields are preserved exactly.
 * - It refuses to overwrite an existing, different SUPER_ADMIN.
 * - Re-running it is a no-op once the target is an active SUPER_ADMIN.
 * - No password, hash, or secret is ever logged or returned.
 */
@Injectable()
export class SuperAdminBootstrapService {
  constructor(private readonly prisma: PrismaClient) {}

  async run(input: BootstrapSuperAdminInput): Promise<BootstrapSuperAdminResult> {
    const email = (input.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new BootstrapError('SEED_ADMIN_EMAIL must not be empty.');
    }
    // The address is a public configuration constant, not a secret.
    if (!isSuperAdminEmail(email)) {
      throw new BootstrapError(`SEED_ADMIN_EMAIL must be ${SUPER_ADMIN_EMAIL}.`);
    }

    const expectedUserId = input.expectedUserId?.trim();
    if (expectedUserId && !/^[A-Za-z0-9_-]+$/.test(expectedUserId)) {
      throw new BootstrapError('SEED_ADMIN_USER_ID has an invalid format.');
    }

    const target = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!target) {
      throw new BootstrapError(
        'The owner account does not exist. Register it normally before bootstrapping.',
      );
    }
    if (expectedUserId && target.id !== expectedUserId) {
      throw new BootstrapError('The owner account ID does not match SEED_ADMIN_USER_ID.');
    }

    // Never overwrite a Super Admin that is already established elsewhere.
    const otherSuperAdmin = await this.prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN, NOT: { id: target.id } },
      select: { id: true },
    });
    if (otherSuperAdmin) {
      throw new BootstrapError(
        'A different Super Admin already exists; refusing to overwrite it.',
      );
    }

    // Idempotent: an already-active Super Admin needs no write or audit record.
    if (target.role === UserRole.SUPER_ADMIN && target.isActive) {
      return {
        id: target.id,
        email: target.email,
        role: target.role,
        isActive: true,
        changed: false,
      };
    }

    // Promote ONLY the target. Deliberately no passwordHash/id/tokenVersion here.
    await this.prisma.user.update({
      where: { id: target.id },
      data: { role: UserRole.SUPER_ADMIN, isActive: true },
    });

    // Metadata-only audit record. Never block bootstrap on audit availability.
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorUserId: target.id,
          action: 'SUPER_ADMIN_BOOTSTRAPPED',
          resourceType: 'USER',
          resourceId: target.id,
          outcome: 'promoted',
        },
      });
    } catch {
      // Intentionally silent: do not leak internal detail or block promotion.
    }

    return {
      id: target.id,
      email: target.email,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      changed: true,
    };
  }
}
