'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { HorizontalList, HorizontalListItem } from '@op/ui/HorizontalList';
import { SkeletonLine } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
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
  variant,
}: {
  profile: Organization;
  className?: string;
  limit?: number;
  variant?: string;
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
    handleModalClose,
  } = usePostFeedActions();

  // Prevent infinite loops. Make sure this is a stable function
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

  return variant === 'cards' ? (
    <HorizontalList
      className={cn(
        'w-full scroll-px-4 items-start',
        allPosts.length === 0 && 'overflow-x-hidden',
      )}
    >
      {allPosts.length > 0 ? (
        allPosts.map((postToOrg) => (
          <HorizontalListItem
            key={postToOrg.postId}
            className="w-11/12 max-w-96 shrink-0 snap-start rounded border p-3 first:ml-4 last:mr-4"
          >
            <PostItem
              post={postToOrg.post}
              organization={postToOrg.organization ?? null}
              user={user}
              withLinks={false}
              onReactionClick={handleReactionClick}
              onCommentClick={handleCommentClick}
            />
          </HorizontalListItem>
        ))
      ) : (
        <HorizontalListItem className="w-11/12 max-w-96 shrink-0 snap-start rounded border p-3 first:ml-4 last:mr-4">
          <EmptyPostsState />
        </HorizontalListItem>
      )}
      {shouldShowTrigger && (
        <HorizontalListItem>
          <div ref={ref as React.RefObject<HTMLDivElement>}>
            {isFetchingNextPage ? (
              <div className="text-sm text-neutral-gray4">
                <SkeletonLine lines={2} />
              </div>
            ) : null}
          </div>
        </HorizontalListItem>
      )}
    </HorizontalList>
  ) : (
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
