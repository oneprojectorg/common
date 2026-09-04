'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type {
  CommonUser,
  Organization,
  Post,
  PostToOrganization,
} from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { HorizontalList, HorizontalListItem } from '@op/sense/HorizontalList';
import { SkeletonText } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { Fragment, type RefCallback, useCallback } from 'react';

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
  user: CommonUser;
  infiniteScrollRef: RefCallback<HTMLElement>;
  shouldShowTrigger: boolean;
  isFetchingNextPage: boolean;
  handleLikeClick: (postId: string) => Promise<unknown>;
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
  const { user } = useRequiredUser();
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
    handleLikeClick,
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
    handleLikeClick,
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
  handleLikeClick: onLikeClick,
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
              className="w-11/12 max-w-96 shrink-0 snap-start rounded border p-3 first:ms-4 last:me-4"
            >
              <PostItem
                post={postToOrg.post}
                organization={postToOrg.organization ?? null}
                user={user}
                withLinks={false}
                onLikeClick={onLikeClick}
                onCommentClick={onCommentClick}
              />
            </HorizontalListItem>
          ))
        ) : (
          <HorizontalListItem className="w-11/12 max-w-96 shrink-0 snap-start rounded border p-3 first:ms-4 last:me-4">
            <EmptyPostsState />
          </HorizontalListItem>
        )}
        {shouldShowTrigger && (
          <HorizontalListItem>
            <div ref={infiniteScrollRef}>
              {isFetchingNextPage ? <SkeletonText lines={2} /> : null}
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
  handleLikeClick: onLikeClick,
  handleCommentClick: onCommentClick,
  discussionModal,
  handleModalClose: onModalClose,
  className,
}: ProfileFeedRenderProps & { className?: string }) => {
  return (
    <div className={className}>
      <PostFeed className="gap-0">
        {posts.length > 0 ? (
          posts.map((postToOrg) => (
            <Fragment key={postToOrg.postId}>
              <PostItem
                post={postToOrg.post}
                organization={postToOrg.organization ?? null}
                user={user}
                withLinks={false}
                onLikeClick={onLikeClick}
                onCommentClick={onCommentClick}
                className="p-4"
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
        <div ref={infiniteScrollRef} className="flex justify-center py-4">
          {isFetchingNextPage ? <SkeletonText lines={2} /> : null}
        </div>
      )}
    </div>
  );
};
