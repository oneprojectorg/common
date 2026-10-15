import { getRequiredUser } from '@/utils/getUser';
import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { PAGE_LIMIT } from '@op/common/client';
import { logger } from '@op/logging';
import { Header1 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import { getTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { PostFeedSkeleton } from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

import { Feed } from './Feed';

/**
 * Posts from organizations across Common (Figma 21477:64224). Moved off the
 * home page, which now centres on the user's own processes.
 */
export const UpdatesScreen = async () => {
  const t = await getTranslations();

  return (
    <ListPageLayout>
      <div className="flex flex-col gap-2">
        <Header1 className="text-headline">
          {t('shell.updatesNavTitle')}
        </Header1>
        <p className="text-muted-foreground">
          {t('shell.updatesPageSubtitle')}
        </p>
      </div>
      <Suspense fallback={<PostFeedSkeleton numPosts={3} />}>
        <UpdatesFeed />
      </Suspense>
    </ListPageLayout>
  );
};

const UpdatesFeed = async () => {
  // Prefetch on the server to prevent a hydration mismatch; if this fails the
  // client fetches instead.
  const [t, user, { utils, queryClient }] = await Promise.all([
    getTranslations(),
    getRequiredUser(),
    createServerUtils(),
  ]);
  try {
    await utils.organization.listAllPosts.fetchInfinite({
      limit: PAGE_LIMIT.sm,
    });
  } catch (e) {
    logger.error('Updates post prefetch failed', { error: e });
  }

  return (
    <>
      {user.currentProfile?.type === 'org' ? (
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <PostUpdate label={t('Post')} />
        </Suspense>
      ) : null}
      <ErrorBoundary
        fallback={
          <div className="flex flex-col items-center justify-center py-8">
            <span>{t('shell.feedLoadError')}</span>
          </div>
        }
      >
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Feed />
        </HydrationBoundary>
      </ErrorBoundary>
    </>
  );
};
