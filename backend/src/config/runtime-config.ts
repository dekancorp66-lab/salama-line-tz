export type TrustProxySetting = boolean | number | string[];

export interface RuntimeConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtAccessTtl: string;
  frontendOrigins: string[];
  contactHashSecret?: string;
  swaggerEnabled: boolean;
  loginMaxAttempts: number;
  loginLockMinutes: number;
  trustProxy: TrustProxySetting;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Express `trust proxy` setting. Defaults to false (never trust forwarded
 * headers) so per-client rate limiting fails closed unless an operator
 * explicitly configures the trusted proxy hops or addresses.
 */
function parseTrustProxy(value: string | undefined): TrustProxySetting {
  const raw = value?.trim();
  if (!raw) return false;
  if (raw.toLowerCase() === 'true') return true;
  if (raw.toLowerCase() === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  const entries = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
  return entries.length ? entries : false;
}

/**
 * Fail closed on configuration that would weaken authentication or expose an
 * administrative API. Kept as a pure function so it can be unit tested without
 * starting Nest or connecting to a database.
 */
export function readRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const nodeEnv = (env.NODE_ENV || 'development').trim();
  const isProduction = nodeEnv === 'production';
  const errors: string[] = [];

  const databaseUrl = env.DATABASE_URL?.trim() || '';
  if (!databaseUrl) errors.push('DATABASE_URL is required');

  const jwtAccessSecret = env.JWT_ACCESS_SECRET?.trim() || '';
  if (!jwtAccessSecret) {
    errors.push('JWT_ACCESS_SECRET is required; there is no development fallback');
  } else if (jwtAccessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters');
  }

  const contactHashSecret = env.CONTACT_HASH_SECRET?.trim() || undefined;
  if (isProduction && (!contactHashSecret || contactHashSecret.length < 32)) {
    errors.push('CONTACT_HASH_SECRET must be set to at least 32 characters in production');
  }

  const frontendOrigins = (env.FRONTEND_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (isProduction && frontendOrigins.length === 0) {
    errors.push('FRONTEND_ORIGINS must contain at least one deployed frontend origin in production');
  }

  if (errors.length) {
    throw new Error(`Invalid SalamaLine runtime configuration:\n- ${errors.join('\n- ')}`);
  }

  return {
    nodeEnv,
    port: positiveInteger(env.PORT, 3000),
    apiPrefix: (env.API_PREFIX || 'api/v1').split('/').filter(Boolean).join('/'),
    databaseUrl,
    jwtAccessSecret,
    jwtAccessTtl: env.JWT_ACCESS_TTL?.trim() || '15m',
    frontendOrigins,
    contactHashSecret,
    // Documentation is disabled unless explicitly enabled.
    swaggerEnabled: env.SWAGGER_ENABLED === 'true',
    loginMaxAttempts: positiveInteger(env.LOGIN_MAX_ATTEMPTS, 5),
    loginLockMinutes: positiveInteger(env.LOGIN_LOCK_MINUTES, 15),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
  };
}
