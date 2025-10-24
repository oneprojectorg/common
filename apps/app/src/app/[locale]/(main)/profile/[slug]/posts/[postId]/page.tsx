'use client';

import { trpc } from '@op/api/client';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { PostDetailView } from '@/components/posts/PostDetailView';

function PostDetailPageContent({ postId }: { postId: string }) {
  const [post] = trpc.posts.getPost.useSuspenseQuery({
    postId,
    includeChildren: false,
  });

  if (!post) {
    notFound();
  }

  return <PostDetailView post={post} />;
}

function PostDetailPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Content loading */}
      <div className="flex-1 px-4 py-8">
        <div className="space-y-6">
          {/* Post skeleton */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          </div>

          <hr className="bg-gray-200" />

          {/* Comments skeleton */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white p-4">
        <div className="h-24 w-full animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

const PostDetailPage = () => {
  const { postId } = useParams<{
    postId: string;
    slug: string;
  }>();

  return (
    <ErrorBoundary>
      <Suspense fallback={<PostDetailPageSkeleton />}>
        <PostDetailPageContent postId={postId} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default PostDetailPage;
