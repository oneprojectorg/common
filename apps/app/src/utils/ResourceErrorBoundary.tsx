import { ReactNode } from 'react';

import { forbidden, notFound } from '@/lib/navigation';

import { APIErrorBoundary } from './APIErrorBoundary';

/**
 * Client error boundary that maps a tRPC error thrown by a suspense query onto
 * the matching not-found / forbidden throw, so an unresolvable resource shows
 * an accurate status page instead of bubbling to the route's error screen as
 * a 500:
 *
 *   - 400 (e.g. a malformed id/slug in the URL) → notFound()
 *   - 404 (missing / hidden record)             → notFound()
 *   - 403 (caller lacks access)                  → forbidden()
 *
 * The server-side equivalent is handleServerError(). Any other status rethrows
 * and is handled upstream (a genuine 500, or an outer boundary's fallback).
 */
export const ResourceErrorBoundary = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <APIErrorBoundary
      fallbacks={{
        400: () => notFound(),
        404: () => notFound(),
        403: () => forbidden(),
      }}
    >
      {children}
    </APIErrorBoundary>
  );
};
