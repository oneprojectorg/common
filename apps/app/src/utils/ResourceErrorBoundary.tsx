'use client';

import { forbidden, notFound } from 'next/navigation';
import { ReactNode } from 'react';

import { APIErrorBoundary } from './APIErrorBoundary';

/**
 * Client error boundary that maps a tRPC error thrown by a suspense query onto
 * the matching Next.js navigation interrupt, so an unresolvable resource shows
 * an accurate status page instead of bubbling to error.tsx as a 500:
 *
 *   - 400 (e.g. a malformed id/slug in the URL) → notFound()
 *   - 401 (no session)                          → forbidden()
 *   - 403 (caller lacks access)                 → forbidden()
 *   - 404 (missing / hidden record)             → notFound()
 *
 * handleServerError() is the server-side counterpart, and reviews/[reviewId]
 * inlines a third copy. None of them map exactly the same set — this one is
 * alone in handling 400 — so when adding a status, grep for the siblings: one
 * that only a single site maps still reaches error.tsx as a generic 500.
 *
 * Any other status rethrows and is handled upstream (a genuine 500, or an outer
 * boundary's fallback).
 *
 * Safe to render from a server component — it passes children straight through.
 */
export const ResourceErrorBoundary = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <APIErrorBoundary
      fallbacks={{
        400: notFound,
        401: forbidden,
        403: forbidden,
        404: notFound,
      }}
    >
      {children}
    </APIErrorBoundary>
  );
};
