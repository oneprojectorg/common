'use client';

import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

import { APIErrorBoundary } from './APIErrorBoundary';

/**
 * Client error boundary that turns a tRPC NOT_FOUND (404) thrown by a suspense
 * query into Next.js's notFound() interrupt, so a missing resource renders the
 * 404 page instead of bubbling to error.tsx as a 500.
 *
 * Use it around client components that fetch a resource by slug/id via
 * useSuspenseQuery. Any non-404 error rethrows and is handled upstream.
 *
 * Safe to render from a server component — it passes children straight through.
 */
export const NotFoundErrorBoundary = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <APIErrorBoundary fallbacks={{ 404: () => notFound() }}>
      {children}
    </APIErrorBoundary>
  );
};
