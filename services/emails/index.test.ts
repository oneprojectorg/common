import { describe, expect, it } from 'vitest';

import { formatFromAddress } from './index';

describe('formatFromAddress', () => {
  it('sends from the no-reply mailbox so replies never land in the support inbox', () => {
    expect(formatFromAddress('Example Org via Common')).toBe(
      'Example Org via Common <noreply@oneproject.org>',
    );
  });

  it('falls back to the app name when no display name is given', () => {
    expect(formatFromAddress()).toBe('Common <noreply@oneproject.org>');
  });
});
