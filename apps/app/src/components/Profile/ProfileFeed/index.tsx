'use client';

import type { OrganizationUser } from '@/utils/UserProvider';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization, Post, PostToOrganization } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { HorizontalList, HorizontalListItem } from '@op/ui/HorizontalList';
import { SkeletonLine } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';
import { Fragment, type RefObject, useCallback } from 'react';

import {
  DiscussionModalContainer,
  EmptyPostsState,
  PostFeed,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';

type DiscussionModalState = {
  isOpen: boolean;
  post?: Post | null;
  organization?: Organization | null;
};

export type ProfileFeedRenderProps = {
  posts: PostToOrganization[];
  isEmpty: boolean;
  user: OrganizationUser;
  infiniteScrollRef: RefObject<HTMLElement | null>;
  shouldShowTrigger: boolean;
  isFetchingNextPage: boolean;
  handleReactionClick: (postId: string, emoji: string) => void;
  handleCommentClick: (post: Post, organization: Organization | null) => void;
  discussionModal: DiscussionModalState;
  handleModalClose: () => void;
};

export const ProfileFeedProvider = ({
  profile,
  limit = 20,
  children,
}: {
  profile: Organization;
  limit?: number;
  children: (props: ProfileFeedRenderProps) => React.ReactNode;
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

  const stableFetchNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

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

  return children({
    posts: allPosts,
    isEmpty: allPosts.length === 0,
    user,
    infiniteScrollRef: ref,
    shouldShowTrigger,
    isFetchingNextPage,
    handleReactionClick,
    handleCommentClick,
    discussionModal,
    handleModalClose,
  });
};

export const ProfileFeedCards = ({
  posts,
  user,
  infiniteScrollRef,
  shouldShowTrigger,
  isFetchingNextPage,
  handleReactionClick: onReactionClick,
  handleCommentClick: onCommentClick,
  discussionModal,
  handleModalClose: onModalClose,
  className,
}: ProfileFeedRenderProps & { className?: string }) => {
  return (
    <>
      <HorizontalList
        className={cn(
          'w-full scroll-px-4 items-start',
          posts.length === 0 && 'overflow-x-hidden',
          className,
        )}
      >
        {posts.length > 0 ? (
          posts.map((postToOrg) => (
            <HorizontalListItem
              key={postToOrg.postId}
              className="border-neutral-gray1 w-11/12 max-w-96 shrink-0 snap-start rounded border p-3 first:ml-4 last:mr-4"
            >
              <PostItem
                post={postToOrg.post}
                organization={postToOrg.organization ?? null}
                user={user}
                withLinks={false}
                onReactionClick={onReactionClick}
                onCommentClick={onCommentClick}
              />
            </HorizontalListItem>
          ))
        ) : (
          <HorizontalListItem className="border-neutral-gray1 w-11/12 max-w-96 shrink-0 snap-start rounded border p-3 first:ml-4 last:mr-4">
            <EmptyPostsState />
          </HorizontalListItem>
        )}
        {shouldShowTrigger && (
          <HorizontalListItem>
            <div ref={infiniteScrollRef as React.RefObject<HTMLDivElement>}>
              {isFetchingNextPage ? (
                <div className="text-neutral-gray4 text-sm">
                  <SkeletonLine lines={2} />
                </div>
              ) : null}
            </div>
          </HorizontalListItem>
        )}
      </HorizontalList>
      <DiscussionModalContainer
        discussionModal={discussionModal}
        onClose={onModalClose}
      />
    </>
  );
};

export const ProfileFeedList = ({
  posts,
  user,
  infiniteScrollRef,
  shouldShowTrigger,
  isFetchingNextPage,
  handleReactionClick: onReactionClick,
  handleCommentClick: onCommentClick,
  discussionModal,
  handleModalClose: onModalClose,
  className,
}: ProfileFeedRenderProps & { className?: string }) => {
  return (
    <div className={className}>
      <PostFeed>
        {posts.length > 0 ? (
          posts.map((postToOrg) => (
            <Fragment key={postToOrg.postId}>
              <PostItem
                post={postToOrg.post}
                organization={postToOrg.organization ?? null}
                user={user}
                withLinks={false}
                onReactionClick={onReactionClick}
                onCommentClick={onCommentClick}
              />
              <hr />
            </Fragment>
          ))
        ) : (
          <EmptyPostsState />
        )}

        <DiscussionModalContainer
          discussionModal={discussionModal}
          onClose={onModalClose}
        />
      </PostFeed>
      {shouldShowTrigger && (
        <div
          ref={infiniteScrollRef as React.RefObject<HTMLDivElement>}
          className="flex justify-center py-4"
        >
          {isFetchingNextPage ? (
            <div className="text-neutral-gray4 text-sm">
              <SkeletonLine lines={2} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
