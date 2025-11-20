'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { useInfiniteScroll } from '@op/hooks';
import { Fragment, Suspense, useCallback } from 'react';

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
const FeedContent = () => {
  const { user } = useUser() ?? {};

  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.organization.listAllPosts.useInfiniteQuery(
    { limit: 10 },
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

      {shouldShowTrigger && (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          {isFetchingNextPage ? <PostFeedSkeleton numPosts={1} /> : null}
        </div>
      )}

      <DiscussionModalContainer
        discussionModal={discussionModal}
        onClose={handleModalClose}
      />
    </PostFeed>
  );
};
