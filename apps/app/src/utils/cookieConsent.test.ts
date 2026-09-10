import { describe, expect, it } from 'vitest';

import { isCookieConsentRequired } from './cookieConsent';

describe('isCookieConsentRequired', () => {
  it('does not ask a US visitor', () => {
    expect(isCookieConsentRequired('US')).toBe(false);
  });

  it('tolerates the casing and padding a header can arrive with', () => {
    expect(isCookieConsentRequired('us')).toBe(false);
    expect(isCookieConsentRequired(' US ')).toBe(false);
  });

  it('asks everywhere else', () => {
    for (const country of ['DE', 'GB', 'FR', 'CA', 'BR', 'IN']) {
      expect(isCookieConsentRequired(country)).toBe(true);
    }
  });

  // The header is missing on local and self-hosted runs, and on any request
  // Vercel's edge didn't annotate. Asking is the only safe reading of "unknown".
  it('asks when the country is unresolved', () => {
    expect(isCookieConsentRequired(null)).toBe(true);
    expect(isCookieConsentRequired(undefined)).toBe(true);
    expect(isCookieConsentRequired('')).toBe(true);
  });
});
