/**
 * Pre-start guard for the SalamaLine backend.
 *
 * Prevents a second `npm run start:*` invocation from crashing with EADDRINUSE
 * when a backend is already listening on the configured port. This script only
 * detects and reports; it NEVER kills or signals any process.
 */
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PORT = 3000;

function loadEnvFile() {
  const values = {};
  try {
    const text = fs.readFileSync(path.resolve('.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[match[1]] = value;
    }
  } catch {
    // No .env file (or unreadable); fall back to process.env / defaults.
  }
  return values;
}

const env = loadEnvFile();
const portRaw = process.env.PORT ?? env.PORT ?? String(DEFAULT_PORT);
const parsedPort = Number(portRaw);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
const apiPrefix = (process.env.API_PREFIX ?? env.API_PREFIX ?? 'api/v1')
  .split('/')
  .filter(Boolean)
  .join('/');

/**
 * Bind without a host, matching `app.listen(port)` in src/main.ts. If another
 * process holds the port this resolves true; otherwise it resolves false.
 */
function isPortInUse() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => {
      resolve(error.code === 'EADDRINUSE' || error.code === 'EACCES');
    });
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port);
  });
}

/** Best-effort health probe so we can tell a SalamaLine instance apart from an unrelated process. */
function probeHealth() {
  return new Promise((resolve) => {
    const request = http.get(
      { host: '127.0.0.1', port, path: `/${apiPrefix}/health`, timeout: 800 },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          if (body.length < 4096) body += chunk;
        });
        response.on('end', () => resolve({ status: response.statusCode, body }));
        response.on('error', () => resolve(null));
      },
    );
    request.on('timeout', () => request.destroy(new Error('probe timed out')));
    request.on('error', () => resolve(null));
  });
}

const inUse = await isPortInUse();
if (!inUse) {
  console.log(`[SalamaLine] Port ${port} is available.`);
  process.exit(0);
}

const probe = await probeHealth();
const isSalamaLine =
  probe?.status === 200 && /"service"\s*:\s*"salamaline-api"/.test(probe.body ?? '');

console.error(`\n[SalamaLine] Cannot start: port ${port} is already in use.`);
if (isSalamaLine) {
  console.error('A SalamaLine backend is already running on this port.');
  console.error('Use that instance, or stop it before starting another one:');
  console.error(`  lsof -nP -iTCP:${port} -sTCP:LISTEN`);
  console.error('  kill <PID>   (only after confirming the PID is the SalamaLine backend)');
} else {
  console.error('The port is held by a process that does not look like a SalamaLine backend.');
  console.error('This guard will not stop it. Identify it with:');
  console.error(`  lsof -nP -iTCP:${port} -sTCP:LISTEN`);
  console.error('Then free the port or set PORT to a different value.');
}
console.error('');
process.exit(1);
