import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';

// A fixed, non-secret bcrypt hash keeps unknown-account login attempts on the
// same timing path as known accounts. It is not a credential.
const DUMMY_PASSWORD_HASH = '$2b$12$M949D7QbzB0mVs9.41y83OuMJgxfqzCg1m.D/MdwrBFgu8uc7UqEa';

const INVALID_CREDENTIALS = 'Invalid credentials or account not activated';
const INVALID_RECOVERY = 'Invalid or expired recovery request';

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  private async recordAudit(input: {
    actorUserId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    outcome: string;
  }) {
    try {
      await this.audit.record(input);
    } catch {
      this.logger.warn('An audit event could not be recorded; the request result was not changed.');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashRecoveryToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokensMatch(left?: string | null, right?: string | null): boolean {
    if (!left || !right || left.length !== right.length) return false;
    return timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
  }

  private bcryptRounds(): number {
    const rounds = Math.max(12, Number(process.env.BCRYPT_ROUNDS || 12));
    return Math.min(rounds, 14);
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Unable to create account with these details');
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds());
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName: dto.displayName.trim(), isActive: false },
      select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
    });
    await this.recordAudit({
      actorUserId: user.id,
      action: 'AUTH_REGISTER',
      resourceType: 'USER',
      resourceId: user.id,
      outcome: 'success',
    });
    return { message: 'Account created. An administrator must activate staff access.', user };
  }

  /**
   * Public mobile registration. Deliberately accepts no role: the DTO has no
   * role field and the global ValidationPipe rejects non-whitelisted keys.
   * Privileged accounts can only be created and approved through the admin
   * officer provisioning flow, never through this endpoint.
   */
  async registerPublic(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Unable to create account with these details');
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds());
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName.trim(),
        role: UserRole.USER,
        isActive: true,
      },
      select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
    });
    await this.recordAudit({
      actorUserId: user.id,
      action: 'AUTH_PUBLIC_REGISTER',
      resourceType: 'USER',
      resourceId: user.id,
      outcome: 'success',
    });
    return { message: 'Account created. You can sign in now.', user };
  }

  /**
   * Revokes the current access token by advancing tokenVersion. The JWT
   * strategy compares this value on every request, so already-issued tokens
   * stop working immediately. There is no per-device session model yet, which
   * means signing out also ends any other session for the same account.
   */
  async logout(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException();
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true },
    });
    await this.recordAudit({
      actorUserId: userId,
      action: 'AUTH_LOGOUT',
      resourceType: 'USER',
      resourceId: userId,
      outcome: 'success',
    });
    return { message: 'Signed out. Sign in again to obtain a new access token.' };
  }

  async login(dto: LoginDto) {
    const now = new Date();
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user?.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
      await this.recordAudit({
        actorUserId: user.id,
        action: 'AUTH_LOGIN_LOCKED',
        resourceType: 'USER',
        resourceId: user.id,
        outcome: 'failure',
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Always perform one bcrypt comparison, including for unknown accounts.
    const valid = await bcrypt.compare(dto.password, user?.passwordHash || DUMMY_PASSWORD_HASH);
    const priorFailures =
      user?.lockedUntil && user.lockedUntil.getTime() <= now.getTime() ? 0 : user?.failedLoginAttempts || 0;

    if (!user || !valid || !user.isActive) {
      if (user) {
        const maxAttempts = positiveInteger(process.env.LOGIN_MAX_ATTEMPTS, 5);
        const lockMinutes = positiveInteger(process.env.LOGIN_LOCK_MINUTES, 15);
        const failedAttempts = priorFailures + 1;
        const shouldLock = failedAttempts >= maxAttempts;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: failedAttempts,
            lockedUntil: shouldLock ? new Date(now.getTime() + lockMinutes * 60_000) : null,
          },
        });
        if (shouldLock) {
          await this.recordAudit({
            actorUserId: user.id,
            action: 'AUTH_LOGIN_LOCKOUT',
            resourceType: 'USER',
            resourceId: user.id,
            outcome: 'failure',
          });
        }
      }
      await this.recordAudit({
        actorUserId: user?.id,
        action: 'AUTH_LOGIN_FAILURE',
        resourceType: 'USER',
        resourceId: user?.id,
        outcome: 'failure',
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    await this.recordAudit({
      actorUserId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'USER',
      resourceId: user.id,
      outcome: 'success',
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      ver: user.tokenVersion,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        districtCode: user.districtCode,
      },
    };
  }

  /**
   * Creates a recovery token hash. Delivery must be performed by a reviewed,
   * verified channel; this API never returns the token or indicates whether the
   * account exists.
   */
  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      const ttlMinutes = positiveInteger(process.env.PASSWORD_RESET_TTL_MINUTES, 30);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: this.hashRecoveryToken(token),
          passwordResetExpiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      });
      await this.recordAudit({
        actorUserId: user.id,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        resourceType: 'USER',
        resourceId: user.id,
        outcome: 'success',
      });
      // The token is intentionally not returned or logged. A delivery adapter
      // must be configured before this flow is usable by account holders.
      void token;
    }
    return { message: 'If the account exists, recovery instructions will be sent through an approved channel.' };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const submittedHash = this.hashRecoveryToken(dto.token);

    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() <= Date.now() ||
      !this.tokensMatch(user.passwordResetTokenHash, submittedHash)
    ) {
      await this.recordAudit({
        actorUserId: user?.id,
        action: 'AUTH_PASSWORD_RESET_FAILURE',
        resourceType: 'USER',
        resourceId: user?.id,
        outcome: 'failure',
      });
      throw new UnauthorizedException(INVALID_RECOVERY);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds());
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
      },
    });
    await this.recordAudit({
      actorUserId: user.id,
      action: 'AUTH_PASSWORD_RESET_CONFIRMED',
      resourceType: 'USER',
      resourceId: user.id,
      outcome: 'success',
    });
    return { message: 'Password updated. Sign in again to obtain a new access token.' };
  }
}
