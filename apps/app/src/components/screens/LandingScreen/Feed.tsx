'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Fragment } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import {
  DiscussionModalContainer,
  EmptyPostsState,
  PostFeed,
  PostFeedSkeleton,
  PostItem,
  usePostFeedActions,
} from '@/components/PostFeed';

export const Feed = () => {
  const { user } = useUser() ?? {};
  const { data: postsData } = useSuspenseQuery({
    queryKey: [['organization', 'listAllPosts'], {}],
    queryFn: () => trpc.organization.listAllPosts.query({}),
  });

  const {
    discussionModal,
    handleReactionClick,
    handleCommentClick,
    handleModalClose,
  } = usePostFeedActions({ user });

  if (!postsData || !user) {
    return <PostFeedSkeleton numPosts={4} />;
  }

  return (
    <PostFeed>
      {postsData.items.length > 0 ? (
        postsData.items.map((postToOrg) => (
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

      <DiscussionModalContainer
        discussionModal={discussionModal}
        onClose={handleModalClose}
      />
    </PostFeed>
  );
};
