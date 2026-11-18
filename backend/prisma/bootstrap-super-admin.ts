import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import {
  BootstrapError,
  SuperAdminBootstrapService,
} from '../src/auth/super-admin-bootstrap.service';

const prisma = new PrismaClient();
const bootstrap = new SuperAdminBootstrapService(prisma);

/**
 * One-time promotion of the existing owner account to SUPER_ADMIN.
 * Reads only configuration from the environment; it never accepts or logs a
 * password. See `npm run bootstrap:super-admin` in package.json.
 */
export async function runBootstrap(): Promise<void> {
  try {
    const email = process.env.SEED_ADMIN_EMAIL;
    const expectedUserId = process.env.SEED_ADMIN_USER_ID;
    if (!email) {
      throw new BootstrapError(
        'Set SEED_ADMIN_EMAIL to the owner account email before bootstrapping.',
      );
    }

    const result = await bootstrap.run({ email, expectedUserId });

    // Metadata only. No password, hash, or token is ever printed.
    if (result.changed) {
      console.log(
        `Super Administrator activated: ${result.email} (id=${result.id}). ` +
          'Existing account id and password hash were preserved.',
      );
    } else {
      console.log(
        `Super Administrator already active: ${result.email} (id=${result.id}). No changes made.`,
      );
    }
  } catch (error) {
    if (error instanceof BootstrapError) {
      console.error(`Super Admin bootstrap failed: ${error.message}`);
    } else {
      console.error(
        'Super Admin bootstrap failed. Check database connectivity and configuration; never share credentials.',
      );
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void runBootstrap();
}
