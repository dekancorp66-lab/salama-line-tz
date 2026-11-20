const CASE_CODE_PATTERN = /^SL-[0-9A-F]{8}(?:[0-9A-F]{8})?$/;

export function normalizeCaseCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidCaseCode(value: string): boolean {
  return CASE_CODE_PATTERN.test(normalizeCaseCode(value));
}
