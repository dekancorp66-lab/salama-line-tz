import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS } from './config';
import { tokenStore } from './tokenStore';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * AuthProvider registers a callback so a 401 can clear in-memory session state
 * as well as the stored token. No tokens, headers, bodies or response text are
 * ever passed to this callback.
 */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    // Never log response bodies: they may contain confidential request data.
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) {
      await tokenStore.remove();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);
