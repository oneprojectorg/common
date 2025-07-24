'use client';

import { trpc } from '@op/api/client';

import { 
  PostFeed, 
  PostFeedSkeleton, 
  PostsList, 
  EmptyPostsState,
  DiscussionModalContainer,
  usePostFeedActions 
} from '@/components/PostFeed';

export const Feed = () => {
  const { data: user } = trpc.account.getMyAccount.useQuery();
  const {
    data: postsData,
    isLoading,
    error,
  } = trpc.organization.listAllPosts.useQuery({});

  const { 
    discussionModal, 
    handleReactionClick, 
    handleCommentClick, 
    handleModalClose 
  } = usePostFeedActions();

  if (isLoading) {
    return <PostFeedSkeleton numPosts={4} />;
  }

  if (error) {
    console.error('Failed to load posts:', error);
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <span className="text-neutral-charcoal">
          Unable to load posts. Please try refreshing.
        </span>
      </div>
    );
  }

  if (!postsData || !user) {
    return <PostFeedSkeleton numPosts={4} />;
  }

  return (
    <PostFeed>
      {postsData.items.length > 0 ? (
        <PostsList
          posts={postsData.items}
          user={user}
          withLinks={true}
          onReactionClick={handleReactionClick}
          onCommentClick={handleCommentClick}
        />
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
