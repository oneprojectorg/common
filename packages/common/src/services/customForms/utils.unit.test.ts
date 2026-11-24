import { describe, expect, it } from 'vitest';

import { getFormRequiredCapabilities, getFormTrigger } from './utils';

describe('getFormTrigger', () => {
  it('opens on entry only for an explicit entry value', () => {
    expect(getFormTrigger({ 'x-trigger': 'entry' })).toBe('entry');
    expect(getFormTrigger({ 'x-trigger': 'action' })).toBe('action');
    expect(getFormTrigger({ 'x-trigger': 'later' })).toBe('action');
    expect(getFormTrigger({})).toBe('action');
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
