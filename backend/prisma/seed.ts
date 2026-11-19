// `npm run seed` (prisma db seed) uses this conventional entrypoint.
// The super-admin bootstrap has a single implementation shared with the
// dedicated `npm run bootstrap:super-admin` command.
import { runBootstrap } from './bootstrap-super-admin';

void runBootstrap();
