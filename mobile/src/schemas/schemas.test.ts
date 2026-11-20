import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import en from '../i18n/locales/en.json';
import sw from '../i18n/locales/sw.json';
import { makeSupportSchema } from './supportSchema';

function translator(dictionary: Record<string, unknown>) {
  return (key: string) => {
    const parts = key.split('.');
    let current: unknown = dictionary;
    for (const part of parts) {
      current = (current as Record<string, unknown>)?.[part];
    }
    return typeof current === 'string' ? current : key;
  };
}

const valid = {
  topic: 'HEALTH',
  details: 'A short description',
  regionId: 'arusha',
  districtId: 'arusha-arusha-city',
  consentToContact: false,
  contact: '',
  anonymousReport: true,
  locationConsentGiven: false,
};

describe('support form validation language', () => {
  it('uses English validation messages for English UI', () => {
    const result = makeSupportSchema(translator(en)).safeParse({
      ...valid,
      topic: '',
      details: '',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      assert.ok(messages.includes(en.support.validation.topic));
      assert.ok(messages.includes(en.support.validation.details));
    }
  });

  it('uses Kiswahili validation messages for Kiswahili UI', () => {
    const result = makeSupportSchema(translator(sw)).safeParse({
      ...valid,
      topic: '',
      details: '',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      assert.ok(messages.includes(sw.support.validation.topic));
      assert.ok(messages.includes(sw.support.validation.details));
    }
  });

  it('requires contact details only when contact consent is given', () => {
    const schema = makeSupportSchema(translator(sw));
    assert.equal(schema.safeParse(valid).success, true);
    const result = schema.safeParse({ ...valid, consentToContact: true, contact: '' });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(
        result.error.issues.some(
          (issue) => issue.message === sw.support.validation.contact,
        ),
      );
    }
  });
});
