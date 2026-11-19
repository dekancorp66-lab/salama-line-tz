/**
 * Resolves the NestJS API base URL without ever baking a developer localhost
 * into a production bundle. Kept free of `import.meta.env` so it can be unit
 * tested with plain Node.
 */
export function resolveApiBase(configured: string | undefined, isDev: boolean): string {
  const trimmed = configured?.trim();
  if (trimmed) {
    const base = trimmed.replace(/\/+$/, "");
    if (isDev) return base;
    // A localhost configured for local development must not be shipped to a
    // deployed browser, where it would point at the visitor's own machine.
    if (/(^|\/\/)(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(base)) {
      return "/api/v1";
    }
    return base;
  }
  return isDev ? "http://localhost:3000/api/v1" : "/api/v1";
}
