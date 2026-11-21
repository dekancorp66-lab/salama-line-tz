import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import i18n from '../i18n';
import {
  makeLoginSchema,
  makeRegisterSchema,
  type RegisterFormValues,
} from './authSchema';

const keyTranslator = (key: string) => key;

const VALID: RegisterFormValues = {
  email: 'parent@example.org',
  displayName: 'Amani Juma',
  password: 'A-long-password-123!',
  confirmPassword: 'A-long-password-123!',
};

function issuesFor(schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } } }, value: unknown) {
  const result = schema.safeParse(value);
  assert.equal(result.success, false);
  return result.error!.issues;
}

describe('registration validation', () => {
  it('accepts valid public registration fields', () => {
    const parsed = makeRegisterSchema(keyTranslator).safeParse(VALID);
    assert.equal(parsed.success, true);
  });

  it('rejects an invalid email', () => {
    const issues = issuesFor(makeRegisterSchema(keyTranslator), {
      ...VALID,
      email: 'not-an-email',
    });
    assert.ok(issues.some((issue) => issue.path[0] === 'email'));
  });

  it('rejects a password shorter than the backend minimum of 12', () => {
    const issues = issuesFor(makeRegisterSchema(keyTranslator), {
      ...VALID,
      password: 'short',
      confirmPassword: 'short',
    });
    assert.ok(
      issues.some(
        (issue) =>
          issue.path[0] === 'password' &&
          issue.message === 'auth.validation.password',
      ),
    );
  });

  it('rejects mismatched confirmation passwords', () => {
    const issues = issuesFor(makeRegisterSchema(keyTranslator), {
      ...VALID,
      confirmPassword: 'A-different-password-123!',
    });
    assert.ok(
      issues.some(
        (issue) =>
          issue.path[0] === 'confirmPassword' &&
          issue.message === 'auth.validation.passwordMatch',
      ),
    );
  });

  it('rejects a display name outside 2-80 characters', () => {
    const issues = issuesFor(makeRegisterSchema(keyTranslator), {
      ...VALID,
      displayName: 'A',
    });
    assert.ok(issues.some((issue) => issue.path[0] === 'displayName'));
  });

  it('uses translated validation messages in both languages', async () => {
    await i18n.changeLanguage('en');
    const english = makeRegisterSchema((key) => i18n.t(key)).safeParse({
      ...VALID,
      email: 'bad',
    });
    await i18n.changeLanguage('sw');
    const swahili = makeRegisterSchema((key) => i18n.t(key)).safeParse({
      ...VALID,
      email: 'bad',
    });

    assert.equal(english.success, false);
    assert.equal(swahili.success, false);
    if (!english.success && !swahili.success) {
      assert.equal(english.error.issues[0].message, 'Enter a valid email address.');
      assert.equal(swahili.error.issues[0].message, 'Weka barua pepe sahihi.');
      assert.notEqual(
        english.error.issues[0].message,
        swahili.error.issues[0].message,
      );
    }
    await i18n.changeLanguage('en');
  });
});

describe('login validation', () => {
  it('accepts email and a non-empty password', () => {
    const parsed = makeLoginSchema(keyTranslator).safeParse({
      email: 'parent@example.org',
      password: 'any-password',
    });
    assert.equal(parsed.success, true);
  });

  it('rejects a missing password and an invalid email', () => {
    const issues = issuesFor(makeLoginSchema(keyTranslator), {
      email: 'bad',
      password: '',
    });
    assert.ok(issues.some((issue) => issue.path[0] === 'email'));
    assert.ok(issues.some((issue) => issue.path[0] === 'password'));
  });
});
