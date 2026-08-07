import { handleServerError } from '@/utils/handleServerError';
import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { Skeleton } from '@op/sense/Skeleton';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense, cache } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { PostDetail } from '@/components/posts/PostDetailView';

// Module-scoped cache() so generateMetadata and the page body share one
// fetch per (postId, slug) pair within a request. .fetch() also populates
// the shared queryClient, which HydrationBoundary then dehydrates — so the
// client useSuspenseQuery hydrates without a second request.
const fetchPost = cache(async (postId: string) => {
  const { utils } = await createServerUtils();
  return utils.posts.getPost.fetch({ postId, includeChildren: false });
});

const fetchOrganizationBySlug = cache(async (slug: string) => {
  const { utils } = await createServerUtils();
  return utils.organization.getBySlug.fetch({ slug });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string; slug: string; locale: string }>;
}): Promise<Metadata> {
  const { postId, slug, locale } = await params;

  try {
    const [t, post, organization] = await Promise.all([
      getTranslations({ locale }),
      fetchPost(postId),
      fetchOrganizationBySlug(slug),
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
  const { queryClient } = await createServerUtils();

  // Shares the cache()-wrapped fetches with generateMetadata above, so each
  // resolver runs once and the data hydrates into HydrationBoundary. A missing
  // post/org throws NotFoundError here; translate it to a 404 instead of
  // letting it bubble to error.tsx as a 500.
  try {
    await Promise.all([fetchPost(postId), fetchOrganizationBySlug(slug)]);
  } catch (error) {
    handleServerError(error);
  }

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
