'use client';

import { trpc } from '@op/api/client';

import { PostFeed, PostFeedSkeleton } from '@/components/PostFeed';

export const Feed = () => {
  const { data: user } = trpc.account.getMyAccount.useQuery();
  const {
    data: postsData,
    isLoading,
    error,
  } = trpc.organization.listAllPosts.useQuery({});

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

  return <PostFeed user={user} posts={postsData.items} />;
};
