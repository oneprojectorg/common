import { describe, expect, it } from 'vitest';

import { clipSmsText } from './text';

describe('clipSmsText', () => {
  it('given text within the limit, then it is returned whole', () => {
    expect(clipSmsText('short', 10)).toBe('short');
  });

  it('given text over the limit, then it is cut to the limit with a three-dot ellipsis', () => {
    expect(clipSmsText('a long sentence', 8)).toBe('a lon...');
    expect(clipSmsText('a long sentence', 8)).toHaveLength(8);
  });

  it('given text over the limit, then the clipped text stays in the GSM-7 basic set so Twilio keeps 160-character segments', () => {
    expect(clipSmsText('a long sentence', 8)).toMatch(/^[\x20-\x7E]*$/);
  });
});
