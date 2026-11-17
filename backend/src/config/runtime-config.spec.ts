import { readRuntimeConfig } from './runtime-config';

const validEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/salamaline?schema=public',
  JWT_ACCESS_SECRET: 'a-long-random-development-secret-at-least-32-chars',
};

describe('runtime configuration validation', () => {
  it('accepts a development configuration and keeps Swagger off by default', () => {
    const config = readRuntimeConfig(validEnv);
    expect(config.jwtAccessSecret).toBe(validEnv.JWT_ACCESS_SECRET);
    expect(config.swaggerEnabled).toBe(false);
    expect(config.loginMaxAttempts).toBe(5);
    expect(config.loginLockMinutes).toBe(15);
  });

  it('rejects a missing or short JWT secret without a fallback', () => {
    expect(() => readRuntimeConfig({ ...validEnv, JWT_ACCESS_SECRET: '' })).toThrow(
      /JWT_ACCESS_SECRET is required/,
    );
    expect(() => readRuntimeConfig({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it('requires a database URL', () => {
    expect(() => readRuntimeConfig({ ...validEnv, DATABASE_URL: '' })).toThrow(
      /DATABASE_URL is required/,
    );
  });

  it('requires production CORS origins and contact hash configuration', () => {
    expect(() =>
      readRuntimeConfig({
        ...validEnv,
        NODE_ENV: 'production',
        CONTACT_HASH_SECRET: 'a-separate-production-secret-at-least-32',
      }),
    ).toThrow(/FRONTEND_ORIGINS/);

    expect(() =>
      readRuntimeConfig({
        ...validEnv,
        NODE_ENV: 'production',
        FRONTEND_ORIGINS: 'https://salama.example.org',
      }),
    ).toThrow(/CONTACT_HASH_SECRET/);

    const config = readRuntimeConfig({
      ...validEnv,
      NODE_ENV: 'production',
      FRONTEND_ORIGINS: 'https://salama.example.org',
      CONTACT_HASH_SECRET: 'a-separate-production-secret-at-least-32',
      SWAGGER_ENABLED: 'true',
    });
    expect(config.swaggerEnabled).toBe(true);
    expect(config.frontendOrigins).toEqual(['https://salama.example.org']);
  });
});
