import type { NextRequest } from 'next/server';

/**
 * Transform a Next.js middleware request into logging parameters.
 * Returns a tuple of [message, data] suitable for logger.info(...).
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
      ip:
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        undefined,
    },
  ];
}
