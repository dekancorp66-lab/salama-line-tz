import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from '../src/common/super-admin';

const prisma = new PrismaClient();

class BootstrapError extends Error {}

async function main() {
  const configuredEmail = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!configuredEmail || !password) {
    throw new BootstrapError('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to bootstrap the super administrator.');
  }
  const email = configuredEmail.trim().toLowerCase();
  if (!email) throw new BootstrapError('SEED_ADMIN_EMAIL must not be empty.');
  if (!isSuperAdminEmail(email)) {
    throw new BootstrapError(`SEED_ADMIN_EMAIL must be ${SUPER_ADMIN_EMAIL}.`);
  }
  if (password.length < 14) throw new BootstrapError('SEED_ADMIN_PASSWORD must be at least 14 characters.');
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, role: UserRole.ADMIN, isActive: true },
    });
    console.log('Super administrator access enabled and password updated for the configured account.');
    return;
  }
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: 'SalamaLine Super Administrator',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log('Super administrator created. Keep seed credentials private.');
}

main()
  .catch((error: unknown) => {
    if (error instanceof BootstrapError) {
      console.error(`Administrator bootstrap failed: ${error.message}`);
    } else {
      console.error('Administrator bootstrap failed. Verify database connectivity and configuration without sharing credentials.');
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
