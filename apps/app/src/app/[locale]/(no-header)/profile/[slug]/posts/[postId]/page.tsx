'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { PostDetail } from '@/components/posts/PostDetailView';

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

function PostDetailPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header skeleton */}
      <div className="p-2 px-6 sm:grid-cols-3 md:py-3 grid grid-cols-[auto_1fr_auto] items-center border-b bg-white">
        <Skeleton className="h-6 w-24" />
        <div className="flex justify-center">
          <Skeleton className="h-10 w-96" />
        </div>
        <div className="gap-2 flex items-center justify-end">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Content loading */}
      <div className="max-w-xl p-4 mx-auto flex w-full flex-1 flex-col">
        <div className="gap-2 flex flex-col">
          {/* Post skeleton */}
          <div className="gap-3 flex items-start">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-3 flex-1">
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

          <hr />

          {/* Comment input skeleton */}
          <div className="border-y">
            <div className="gap-3 py-4 flex items-start">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-16 flex-1" />
            </div>
          </div>

          {/* Comments skeleton */}
          <div className="space-y-4">
            <div className="gap-3 flex items-start">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
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
