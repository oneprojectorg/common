import { DecisionUpdateNotificationEmail, render } from '@op/emails';
import { describe, expect, it } from 'vitest';

describe('DecisionUpdateNotificationEmail.subject', () => {
  it('formats author + process title', () => {
    expect(DecisionUpdateNotificationEmail.subject('Ada', 'Budget 2026')).toBe(
      'Ada posted an update in Budget 2026',
    );
  });

  it('preserves special characters in the process title', () => {
    expect(
      DecisionUpdateNotificationEmail.subject('Ada', 'Q&A "Open Floor"'),
    ).toBe('Ada posted an update in Q&A "Open Floor"');
  });
});

describe('DecisionUpdateNotificationEmail whitespace rendering', () => {
  it('preserves author line breaks with white-space: pre-wrap', async () => {
    const html = await render(
      DecisionUpdateNotificationEmail({
        authorName: 'Ada',
        processTitle: 'Budget 2026',
        updateContent: 'First line\nSecond line\n\nAfter a blank line',
        updateUrl: 'https://common.oneproject.org/',
      }),
    );

    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('First line\nSecond line\n\nAfter a blank line');
  });
});
