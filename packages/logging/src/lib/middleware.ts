import type { NextRequest } from 'next/server';

/**
 * Transform a Next.js middleware request into logging parameters.
 * Returns a tuple of [message, data] suitable for logger.info(...).
 *
 * Deliberately carries no client IP: this fires on every proxied request, and
 * an IP is personal data (GDPR Recital 30) that a routine request log is not a
 * proportionate place to retain (Art. 5(1)(c)).
 */
export function transformMiddlewareRequest(
  request: NextRequest,
): [string, Record<string, unknown>] {
  const url = new URL(request.url);

  return [
    `${request.method} ${url.pathname}`,
    {
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      search: url.search,
      host: url.host,
      userAgent: request.headers.get('user-agent') ?? undefined,
      referer: request.headers.get('referer') ?? undefined,
    },
  ];
}
