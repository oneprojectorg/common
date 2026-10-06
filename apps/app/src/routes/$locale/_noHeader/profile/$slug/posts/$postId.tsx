import { prefetchPost } from '@/server/profileRoutes.functions';
import { parseDehydratedState } from '@op/api/dehydratedState';
import { Skeleton } from '@op/sense/Skeleton';
import { HydrationBoundary } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense, useMemo } from 'react';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { PostDetail } from '@/components/posts/PostDetailView';

export const Route = createFileRoute(
  '/$locale/_noHeader/profile/$slug/posts/$postId',
)({
  // The post and its organization are fetched once on the server and hydrate
  // the client's suspense query, so it renders without a second request.
  loader: async ({ params }) => {
    const [t, { dehydratedState, hasPost, orgName }] = await Promise.all([
      getTranslations({ locale: params.locale }),
      prefetchPost({ data: { postId: params.postId, slug: params.slug } }),
    ]);
    const label = t('Post');

    return {
      dehydratedState,
      title: hasPost ? (orgName ? `${label} | ${orgName}` : label) : null,
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title ? [pageTitle(loaderData.title)] : [],
  }),
  component: PostDetailPage,
});

function PostDetailPage() {
  const { postId, slug } = Route.useParams();
  const { dehydratedState } = Route.useLoaderData();
  const hydrationState = useMemo(
    () => parseDehydratedState(dehydratedState),
    [dehydratedState],
  );

  return (
    <HydrationBoundary state={hydrationState}>
      <ErrorBoundary>
        <Suspense fallback={<PostDetailPageSkeleton />}>
          <PostDetail postId={postId} slug={slug} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}

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
