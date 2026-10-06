import { getCookieConsentRequired } from '@/utils/cookieConsent';
import { createServerFn } from '@tanstack/react-start';

/** What the document needs from the request: whether to ask for consent. */
export const getRootRequestData = createServerFn({ method: 'GET' }).handler(
  async () => ({ consentRequired: getCookieConsentRequired() }),
);
