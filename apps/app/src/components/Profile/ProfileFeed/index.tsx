'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonLine } from '@op/ui/Skeleton';
import { useCallback } from 'react';

import { 
  PostFeed, 
  PostItem,
  EmptyPostsState,
  DiscussionModalContainer,
  usePostFeedActions 
} from '@/components/PostFeed';

export const ProfileFeed = ({
  profile,
  className,
  limit = 20,
}: {
  profile: Organization;
  className?: string;
  limit?: number;
}) => {
  const { user } = useUser();
  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.organization.listPosts.useInfiniteQuery(
    {
      slug: profile.profile.slug,
      limit,
    },
    {
      getNextPageParam: (lastPage) => lastPage.next,
      staleTime: 30 * 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );

  const allPosts = paginatedData?.pages.flatMap((page) => page.items) || [];

  const { 
    discussionModal, 
    handleReactionClick, 
    handleCommentClick, 
    handleModalClose 
  } = usePostFeedActions({ slug: profile.profile.slug, limit });

  // Prevent infinite loops. Make sure this is a stable function
  const stableFetchNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  // Only enable infinite scroll if we have enough content and multiple pages
  const hasMultiplePages =
    paginatedData?.pages && paginatedData.pages.length > 1;
  const hasEnoughContent = allPosts.length >= limit * 2; // Require at least 2 pages worth
  const enableInfiniteScroll = hasEnoughContent || hasMultiplePages;

  const { ref, shouldShowTrigger } = useInfiniteScroll(stableFetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '50px',
    enabled: enableInfiniteScroll,
  });

  return (
    <div className={className}>
      <PostFeed>
        {allPosts.length > 0 ? (
          <>
            {allPosts.map((postToOrg, i) => (
              <PostItem
                key={i}
                postToOrg={postToOrg}
                user={user}
                withLinks={false}
                onReactionClick={handleReactionClick}
                onCommentClick={handleCommentClick}
              />
            ))}
          </>
        ) : (
          <EmptyPostsState />
        )}
        
        <DiscussionModalContainer
          discussionModal={discussionModal}
          onClose={handleModalClose}
        />
      </PostFeed>
      {shouldShowTrigger && (
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="flex justify-center py-4"
        >
          {isFetchingNextPage ? (
            <div className="text-sm text-neutral-gray4">
              <SkeletonLine lines={2} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
