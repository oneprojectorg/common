'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { PostDetail } from '@/components/posts/PostDetailView';

function PostDetailPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header skeleton */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center border-b border-neutral-gray1 bg-white p-2 px-6 sm:grid-cols-3 md:py-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex justify-center">
          <Skeleton className="h-10 w-96" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Content loading */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col p-4">
        <div className="flex flex-col gap-2">
          {/* Post skeleton */}
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </div>

          <hr className="bg-neutral-gray1" />

          {/* Comment input skeleton */}
          <div className="border-y border-neutral-gray1">
            <div className="flex items-start gap-3 py-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-16 flex-1" />
            </div>
          </div>

          {/* Comments skeleton */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PostDetailPage = () => {
  const { postId, slug } = useParams<{
    postId: string;
    slug: string;
  }>();

  return (
    <ErrorBoundary>
      <Suspense fallback={<PostDetailPageSkeleton />}>
        <PostDetail postId={postId} slug={slug} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default PostDetailPage;
