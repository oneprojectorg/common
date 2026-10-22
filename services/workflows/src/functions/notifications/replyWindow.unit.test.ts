import { describe, expect, it } from 'vitest';

import { remainingReplyWindow } from './replyWindow';

describe('remainingReplyWindow', () => {
  it('given a deadline ten minutes ahead, then the wait is the time left as a duration in milliseconds', () => {
    const now = Date.UTC(2026, 9, 16, 17, 24, 49);

    expect(remainingReplyWindow(now + 10 * 60_000, now)).toBe(600_000);
  });

  it('given a deadline that has passed, then the wait is one second rather than zero or negative', () => {
    const now = Date.UTC(2026, 9, 16, 17, 40, 0);

    expect(remainingReplyWindow(now - 5_000, now)).toBe(1_000);
  });
});
