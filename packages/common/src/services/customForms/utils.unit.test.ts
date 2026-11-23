import { describe, expect, it } from 'vitest';

import { getFormShowOn } from './utils';

describe('getFormShowOn', () => {
  it('opens on entry only for an explicit entry value', () => {
    expect(getFormShowOn({ 'x-show-on': 'entry' })).toBe('entry');
    expect(getFormShowOn({ 'x-show-on': 'action' })).toBe('action');
    expect(getFormShowOn({ 'x-show-on': 'later' })).toBe('action');
    expect(getFormShowOn({})).toBe('action');
  });
});
