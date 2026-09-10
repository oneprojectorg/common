import { headers } from 'next/headers';

/**
 * Two-letter country code of the visitor, resolved by Vercel's edge network on
 * every request. Vercel overwrites whatever the client sent, so in a deployed
 * environment this can't be spoofed; anywhere else (local, self-hosted, e2e)
 * it's absent or client-supplied.
 */
const COUNTRY_HEADER = 'x-vercel-ip-country';

/**
 * Countries where we ask before setting analytics cookies. The US has no
 * prior-consent requirement — its state privacy laws are opt-*out* regimes —
 * so a US visitor is tracked without being interrupted. Everyone else, and
 * anyone whose country we couldn't resolve, gets asked.
 *
 * Unresolved means asked on purpose: a missing header must never be the reason
 * an EU visitor gets cookies they were never offered.
 */
export const isCookieConsentRequired = (
  country: string | null | undefined,
): boolean => country?.trim().toUpperCase() !== 'US';

export async function getCookieConsentRequired(): Promise<boolean> {
  return isCookieConsentRequired((await headers()).get(COUNTRY_HEADER));
}
