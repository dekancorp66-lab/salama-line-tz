import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidCaseCode, normalizeCaseCode } from './caseCode';

describe('case reference validation', () => {
  it('normalizes whitespace and casing', () => {
    assert.equal(normalizeCaseCode('  sl-a1b2c3d4  '), 'SL-A1B2C3D4');
  });

  it('accepts 8 and 16 hex character references', () => {
    assert.equal(isValidCaseCode('SL-A1B2C3D4'), true);
    assert.equal(isValidCaseCode('SL-A1B2C3D4E5F60718'), true);
    assert.equal(isValidCaseCode('  sl-a1b2c3d4  '), true);
  });

  it('rejects malformed references', () => {
    for (const value of ['', 'SL-', 'SL-GGGGGGGG', 'A1B2C3D4', 'SL-A1B2C3D4E5']) {
      assert.equal(isValidCaseCode(value), false, `${value} should be invalid`);
    }
  });
});
