'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { useInfiniteScroll } from '@op/hooks';
import { Fragment, Suspense, useCallback } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  DiscussionModalContainer,
  EmptyPostsState,
  PostFeed,
  PostFeedSkeleton,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';

/** Main Feed component wrapper */
export const Feed = () => {
  return (
    <Suspense fallback={<PostFeedSkeleton numPosts={10} />}>
      <FeedContent />
    </Suspense>
  );
};

/** Feed content component with live data */
const FeedContent = ({ limit = 10 }: { limit?: number }) => {
  const { user } = useUser() ?? {};
  const t = useTranslations();

  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.organization.listAllPosts.useInfiniteQuery(
    { limit },
    {
      getNextPageParam: (lastPage) => lastPage.next,
      staleTime: 30 * 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );

  const allPosts = paginatedData?.pages.flatMap((page) => page.items) || [];

  const stableFetchNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  // Only enable infinite scroll if we have enough content and multiple pages
  const hasMultiplePages =
    paginatedData?.pages && paginatedData.pages.length > 1;
  const hasEnoughContent = allPosts.length >= limit;
  const enableInfiniteScroll = hasEnoughContent || hasMultiplePages;

  const { ref, shouldShowTrigger } = useInfiniteScroll(stableFetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '50px',
    enabled: enableInfiniteScroll,
  });

  const {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  } = usePostFeedActions({ user });

  if (!paginatedData || !user) {
    return <PostFeedSkeleton numPosts={4} />;
  }

  return (
    <PostFeed>
      {allPosts.length > 0 ? (
        allPosts.map((postToOrg) => (
          <Fragment key={postToOrg.postId}>
            <PostItem
              post={postToOrg.post}
              organization={postToOrg.organization ?? null}
              user={user}
              withLinks={true}
              onReactionClick={handleReactionClick}
              onCommentClick={handleCommentClick}
            />
            <hr className="bg-neutral-gray1" />
          </Fragment>
        ))
      ) : (
        <EmptyPostsState />
      )}

      {shouldShowTrigger ? (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          {isFetchingNextPage ? <PostFeedSkeleton numPosts={1} /> : null}
        </div>
      ) : (
        <p className="w-full p-4 text-center text-sm text-neutral-500">
          {t('No more updates.')}
        </p>
      )}

      <DiscussionModalContainer
        discussionModal={discussionModal}
        onClose={handleModalClose}
      />
    </PostFeed>
  );
};
