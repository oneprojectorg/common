/**
 * posthog-js persists its distinct id (an anonymous id before login, the auth
 * user id after `posthog.identify()`) as JSON under the cookie
 * `ph_<project_key>_posthog`. Reading it server-side lets logs stamp
 * `posthogDistinctId` even when no authenticated user is available — logged-out
 * visitors, requests rejected before auth resolves, and RSC / route-handler /
 * Server Action paths that never reach the tRPC auth middlewares — so those
 * records still link to the person's timeline in PostHog.
 */
export function getPosthogCookieName(): string | undefined {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  return key ? `ph_${key}_posthog` : undefined;
}

export function parsePosthogDistinctId(
  cookieValue: string | undefined | null,
): string | undefined {
  if (!cookieValue) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(cookieValue);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'distinct_id' in parsed &&
      typeof parsed.distinct_id === 'string'
    ) {
      return parsed.distinct_id;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract the PostHog distinct id from a raw `Cookie` request header. For
 * contexts without a cookie-parsing helper (e.g. the `onRequestError`
 * instrumentation hook, which only sees `request.headers`).
 */
export function getPosthogDistinctIdFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | undefined {
  const name = getPosthogCookieName();
  if (!name || !cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() !== name) {
      continue;
    }
    const rawValue = part.slice(separator + 1).trim();
    return parsePosthogDistinctId(decodeURIComponent(rawValue));
  }
  return undefined;
}
