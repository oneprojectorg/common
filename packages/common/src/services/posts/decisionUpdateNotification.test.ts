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

describe('DecisionUpdateNotificationEmail rendering', () => {
  it('lets a long unbreakable URL wrap so it stays inside the card', async () => {
    const longUrl = `https://example.com/events/kickoff?utm_campaign=${'a'.repeat(400)}`;

    const html = await render(
      DecisionUpdateNotificationEmail({
        authorName: 'Ada',
        processTitle: 'Budget 2026',
        updateContent: longUrl,
        updateUrl: 'https://common.oneproject.org/',
      }),
    );

    // The content must render and carry the wrap style that stops the URL from
    // stretching the 600px card (regression: a bare `text-lg` let it overflow).
    expect(html).toContain(longUrl);
    expect(html).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
