import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { AuthCodeEmail } from './AuthCodeEmail';
import { ContentFlaggedEmail } from './ContentFlaggedEmail';

describe('AuthCodeEmail', () => {
  it('lays the code out one digit per cell so no run of digits reads as a phone number', async () => {
    const html = await render(
      AuthCodeEmail({ ...AuthCodeEmail.PreviewProps, code: '4815162342' }),
    );

    const digits = [...html.matchAll(/data-code-digit[^>]*>(\d)</g)].map(
      (match) => match[1],
    );
    expect(digits.join('')).toBe('4815162342');
    expect(html).not.toContain('4815162342');
  });

  it('renders right-to-left copy with the code still left-to-right', async () => {
    const html = await render(
      AuthCodeEmail({ ...AuthCodeEmail.PreviewProps, lang: 'ar', dir: 'rtl' }),
    );

    const htmlTag = html.match(/<html[^>]*>/)?.[0];
    expect(htmlTag).toContain('lang="ar"');
    expect(htmlTag).toContain('dir="rtl"');
    expect(html).toMatch(/<table[^>]*dir="ltr"/);
  });

  it('leaves the other emails in English, left to right, with the English footer', async () => {
    const html = await render(
      ContentFlaggedEmail(ContentFlaggedEmail.PreviewProps),
    );

    const htmlTag = html.match(/<html[^>]*>/)?.[0];
    expect(htmlTag).toContain('lang="en"');
    expect(htmlTag).toContain('dir="ltr"');
    expect(html).toContain('Common is maintained by One Project.');
  });
});
