declare const process: { env: Record<string, string | undefined> };

const configured = process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL = (configured && configured.trim().length > 0
  ? configured.trim()
  : 'http://localhost:3000/api/v1'
).replace(/\/+$/, '');

export const API_TIMEOUT_MS = 15_000;
