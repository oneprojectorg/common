'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { useInfiniteScroll } from '@op/hooks';
import { Fragment, useCallback } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
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
    <ErrorBoundary>
      <FeedContent />
    </ErrorBoundary>
  );
};

/** Feed content component with live data */
const FeedContent = ({ limit = 10 }: { limit?: number }) => {
  const { user } = useUser();
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

  const { ref, shouldShowTrigger } = useInfiniteScroll(stableFetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '50px',
  });

  const {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  } = usePostFeedActions();

  if (!paginatedData || !user) {
    return <PostFeedSkeleton numPosts={4} />;
  }

  return (
    <PostFeed>
      {allPosts.length === 0 && <EmptyPostsState />}

      {allPosts.map((postToOrg) => (
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
      ))}

      {allPosts.length > 0 && shouldShowTrigger && (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          {isFetchingNextPage && <PostFeedSkeleton numPosts={1} />}
        </div>
      )}

      {allPosts.length > 0 && !shouldShowTrigger && (
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
