import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getThemeToggleTarget } from './toggle';

describe('theme toggle target', () => {
  it('offers dark mode while the app is light', () => {
    assert.equal(getThemeToggleTarget('light'), 'dark');
  });

  it('offers light mode while the app is dark', () => {
    assert.equal(getThemeToggleTarget('dark'), 'light');
  });
});
