import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ReviewExploreContent } from './ReviewExploreLayoutClient';

interface ReviewExploreLayoutProps {
  slug: string;
  reviewId: string;
}

export function ReviewExploreLayout({
  slug,
  reviewId,
}: ReviewExploreLayoutProps) {
  return (
    <APIErrorBoundary fallbacks={{ 404: () => notFound() }}>
      <Suspense fallback={<ReviewExploreSkeleton />}>
        <ReviewExploreContent slug={slug} reviewId={reviewId} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewExploreSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-6 md:px-8">
        <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-4">
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="hidden flex-1 sm:flex">
        <div className="flex-1 border-r p-12">
          <div className="space-y-4">
            <div className="h-10 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex-1 px-12 pt-12">
          <div className="space-y-6">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
