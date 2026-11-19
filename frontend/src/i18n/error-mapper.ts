import type { InterpolationValues, TranslationKey } from "./types.ts";

interface ErrorDescriptor {
  key: TranslationKey;
  values?: InterpolationValues;
}

interface ErrorLike {
  status?: unknown;
  message?: unknown;
  name?: unknown;
}

function asErrorLike(error: unknown): ErrorDescriptor {
  if (typeof error === "string") return { key: "errors.loadFailed" };
  if (typeof error !== "object" || error === null) return { key: "errors.generic" };

  const candidate = error as ErrorLike;
  const status = typeof candidate.status === "number" ? candidate.status : undefined;
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const lower = message.toLowerCase();

  if (name === "AbortError" || /took too long|timed? out/.test(lower)) {
    return { key: "errors.timeout" };
  }
  if (/cannot reach|can['’]t reach|network|failed to fetch/.test(lower) || status === 0) {
    return { key: "errors.network" };
  }
  if (/temporarily unavailable|try again shortly/.test(lower) || status === 503) {
    return { key: "errors.unavailable" };
  }
  if (/too many|rate limit|throttl/.test(lower) || status === 429) {
    return { key: "errors.rateLimited" };
  }
  if (/session has expired|invalid or expired access token|unauthorized/.test(lower) || status === 401) {
    return { key: "errors.sessionExpired" };
  }
  if (/invalid credentials|account not activated/.test(lower)) {
    return { key: "apiErrors.invalidCredentials" };
  }
  if (/not activated yet/.test(lower)) {
    return { key: "apiErrors.accountNotActivated" };
  }
  if (/not authorized|insufficient permissions|forbidden/.test(lower) || status === 403) {
    return { key: "apiErrors.insufficientPermissions" };
  }
  if (/anonymous reports? must not include contact|anonymous report cannot include contact/.test(lower)) {
    return { key: "apiErrors.anonymousWithContact" };
  }
  if (/contact (storage|details)|contact is required|without explicit consent/.test(lower)) {
    return { key: "apiErrors.contactNotConfigured" };
  }
  if (/case reference not found|help request not found|case not found/.test(lower)) {
    return { key: "apiErrors.caseNotFound" };
  }
  if (/case reference|case code|sl-/i.test(message) && /invalid|valid|format|required|match/.test(lower)) {
    return { key: "apiErrors.invalidCaseReference" };
  }
  if (/outside your institution/.test(lower)) {
    return { key: "apiErrors.outsideInstitution" };
  }
  if (/outside your authorized district|outside your authorised district/.test(lower)) {
    return { key: "apiErrors.outsideDistrict" };
  }
  if (/no active .*consent|no active share_with_service consent/.test(lower)) {
    return { key: "apiErrors.noActiveConsent" };
  }
  if (/referral target|verification has expired|not active or verified/.test(lower)) {
    return { key: "apiErrors.referralNotVerified" };
  }
  if (/cannot be assigned|cannot be escalated|already assigned|closed case|invalid transition|not allowed/.test(lower)) {
    return { key: "apiErrors.invalidTransition" };
  }
  if (status === 404 || /not found/.test(lower)) {
    return { key: "errors.notFound" };
  }
  if (status === 400 || /validation|invalid|required|must |cannot|should/.test(lower)) {
    return { key: "apiErrors.validationFailed" };
  }
  if (status !== undefined) {
    return { key: "errors.withStatus", values: { status } };
  }
  return { key: "errors.generic" };
}

/** Map an unknown thrown value to a stable, translatable message descriptor. */
export function apiErrorDescriptor(error: unknown): ErrorDescriptor {
  return asErrorLike(error);
}
