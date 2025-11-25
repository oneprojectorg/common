'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonLine } from '@op/ui/Skeleton';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Fragment, useCallback } from 'react';

import {
  DiscussionModalContainer,
  EmptyPostsState,
  PostFeed,
  PostItem,
  usePostFeedActions,
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
  const input = {
    slug: profile.profile.slug,
    limit,
  };

  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [['organization', 'listPosts'], input],
    queryFn: ({ pageParam }) =>
      trpc.organization.listPosts.query({ ...input, cursor: pageParam }),
    initialPageParam: null as string | null | undefined,
    getNextPageParam: (lastPage) => lastPage.next,
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const allPosts = paginatedData?.pages.flatMap((page) => page.items) || [];

  const {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  } = usePostFeedActions({ slug: profile.profile.slug, limit, user });

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
          allPosts.map((postToOrg) => (
            <Fragment key={postToOrg.postId}>
              <PostItem
                post={postToOrg.post}
                organization={postToOrg.organization ?? null}
                user={user}
                withLinks={false}
                onReactionClick={handleReactionClick}
                onCommentClick={handleCommentClick}
              />
              <hr className="bg-neutral-gray1" />
            </Fragment>
          ))
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
