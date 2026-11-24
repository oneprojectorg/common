import { describe, expect, it } from 'vitest';

import { getFormRequiredCapabilities, getFormShowOn } from './utils';

describe('getFormShowOn', () => {
  it('opens on entry only for an explicit entry value', () => {
    expect(getFormShowOn({ 'x-show-on': 'entry' })).toBe('entry');
    expect(getFormShowOn({ 'x-show-on': 'action' })).toBe('action');
    expect(getFormShowOn({ 'x-show-on': 'later' })).toBe('action');
    expect(getFormShowOn({})).toBe('action');
  });
});

describe('getFormRequiredCapabilities', () => {
  it('reads the listed capabilities', () => {
    expect(
      getFormRequiredCapabilities({
        'x-required-capabilities': ['review', 'vote'],
      }),
    ).toEqual(['review', 'vote']);
  });

  it('requires nothing when the key is absent or empty', () => {
    expect(getFormRequiredCapabilities({})).toEqual([]);
    expect(
      getFormRequiredCapabilities({ 'x-required-capabilities': [] }),
    ).toEqual([]);
  });

  it('returns null for a value it cannot fully read', () => {
    expect(
      getFormRequiredCapabilities({
        'x-required-capabilities': ['review', 'admin'],
      }),
    ).toBeNull();
    expect(
      getFormRequiredCapabilities({ 'x-required-capabilities': 'review' }),
    ).toBeNull();
  });
});
