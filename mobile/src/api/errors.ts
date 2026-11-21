export type ApiErrorKey =
  | 'errors.network'
  | 'errors.timeout'
  | 'errors.rateLimited'
  | 'errors.notFound'
  | 'errors.conflict'
  | 'errors.unauthorized'
  | 'errors.forbidden'
  | 'errors.unavailable'
  | 'errors.validation'
  | 'errors.generic';

export function apiErrorKey(error: unknown): ApiErrorKey {
  const candidate = error as {
    code?: string;
    response?: { status?: number };
  };

  if (candidate.code === 'ECONNABORTED' || candidate.code === 'ETIMEDOUT') {
    return 'errors.timeout';
  }

  if (!candidate.response) {
    return 'errors.network';
  }

  switch (candidate.response.status) {
    case 400:
    case 422:
      return 'errors.validation';
    case 401:
      return 'errors.unauthorized';
    case 403:
      return 'errors.forbidden';
    case 404:
      return 'errors.notFound';
    case 409:
      return 'errors.conflict';
    case 429:
      return 'errors.rateLimited';
    case 503:
    case 504:
      return 'errors.unavailable';
    default:
      return 'errors.generic';
  }
}

export function translateApiError(
  t: (key: string) => string,
  error: unknown,
): string {
  return t(apiErrorKey(error));
}
