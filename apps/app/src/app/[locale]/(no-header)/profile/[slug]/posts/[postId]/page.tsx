import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { Skeleton } from '@op/ui/Skeleton';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { PostDetail } from '@/components/posts/PostDetailView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string; slug: string; locale: string }>;
}): Promise<Metadata> {
  const { postId, slug, locale } = await params;

  try {
    const [{ utils }, t] = await Promise.all([
      createServerUtils(),
      getTranslations({ locale }),
    ]);
    const [post, organization] = await Promise.all([
      utils.posts.getPost.fetch(
        { postId, includeChildren: false },
        { staleTime: 30_000 },
      ),
      utils.organization.getBySlug.fetch({ slug }, { staleTime: 30_000 }),
    ]);

    if (!post) {
      return {};
    }

    const label = t('Post');
    const orgName = organization?.profile?.name;
    return { title: orgName ? `${label} | ${orgName}` : label };
  } catch {
    return {};
  }
}

const PostDetailPage = async ({
  params,
}: {
  params: Promise<{ postId: string; slug: string }>;
}) => {
  const { postId, slug } = await params;
  const { utils, queryClient } = await createServerUtils();

  // Prefetch on the server so the client useSuspenseQuery hydrates without a
  // second request. Shares the cached queryClient with generateMetadata above
  // (staleTime), so each query resolves once per request.
  await Promise.all([
    utils.posts.getPost.prefetch(
      { postId, includeChildren: false },
      { staleTime: 30_000 },
    ),
    utils.organization.getBySlug.prefetch({ slug }, { staleTime: 30_000 }),
  ]).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary>
        <Suspense fallback={<PostDetailPageSkeleton />}>
          <PostDetail postId={postId} slug={slug} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default PostDetailPage;

function PostDetailPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header skeleton */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center border-b bg-white p-2 px-6 sm:grid-cols-3 md:py-3">
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

          <hr />

          {/* Comment input skeleton */}
          <div className="border-y">
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
