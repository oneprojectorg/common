import { DecisionUpdateNotificationEmail } from '@op/emails';
import { describe, expect, it } from 'vitest';

describe('DecisionUpdateNotificationEmail.subject', () => {
  it('formats author + process title', () => {
    expect(
      DecisionUpdateNotificationEmail.subject('Ada', 'Budget 2026'),
    ).toBe('Ada posted an update in Budget 2026');
  });

  it('preserves special characters in the process title', () => {
    expect(
      DecisionUpdateNotificationEmail.subject('Ada', 'Q&A "Open Floor"'),
    ).toBe('Ada posted an update in Q&A "Open Floor"');
  });
});
