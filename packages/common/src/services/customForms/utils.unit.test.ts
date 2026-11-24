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
  it('reads the listed capabilities, none when absent, and null when unreadable', () => {
    expect(
      getFormRequiredCapabilities({ 'x-required-capabilities': ['review'] }),
    ).toEqual(['review']);
    expect(getFormRequiredCapabilities({})).toEqual([]);
    expect(
      getFormRequiredCapabilities({ 'x-required-capabilities': ['admin'] }),
    ).toBeNull();
    expect(
      getFormRequiredCapabilities({ 'x-required-capabilities': 'review' }),
    ).toBeNull();
  });
});
