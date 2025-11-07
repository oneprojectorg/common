'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Surface } from '@op/ui/Surface';
import { Suspense, useCallback } from 'react';
import { notFound } from 'next/navigation';
import React from 'react';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, PostItemOnDetailPage } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { PostDetailHeader } from './PostDetailHeader';
import { PostViewLayout } from './PostViewLayout';
import { usePostDetailActions } from './usePostDetailActions';

type PostFeedUser = NonNullable<ReturnType<typeof useUser>['user']>;

function Comments({
  postId,
  organization,
  user,
  onReactionClick,
}: {
  postId: string;
  organization: Organization | null;
  user: PostFeedUser | undefined;
  onReactionClick: (postId: string, emoji: string) => void;
}) {
  const t = useTranslations();

  const [comments] = trpc.posts.getPosts.useSuspenseQuery({
    parentPostId: postId,
    limit: 50,
    offset: 0,
    includeChildren: false,
  });

  if (comments.length === 0) {
    return (
      <div
        className="py-8 text-center text-neutral-gray4"
        role="status"
        aria-label="No comments"
      >
        {t('No comments yet. Be the first to comment!')}
      </div>
    );
  }

  return (
    <div role="feed" aria-label={`${comments.length} comments`}>
      <PostFeed>
        {comments.map((comment) => (
          <div key={comment.id}>
            <PostItem
              post={comment}
              organization={organization}
              user={user}
              withLinks={false}
              onReactionClick={onReactionClick}
              className="sm:px-0"
            />
            <hr className="mt-4 bg-neutral-gray1" />
          </div>
        ))}
      </PostFeed>
    </div>
  );
}

function CommentsSkeleton() {
  const t = useTranslations();

  return (
    <div
      className="py-8 text-center text-neutral-gray4"
      role="status"
      aria-label="Loading comments"
    >
      {t('Loading comments...')}
    </div>
  );
}

export function PostDetail({
  postId,
  slug,
}: {
  postId: string;
  slug: string;
}) {
  const t = useTranslations();
  const { user } = useUser();

  const [post] = trpc.posts.getPost.useSuspenseQuery({
    postId,
    includeChildren: false,
  });

  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  if (!post) {
    notFound();
  }

  const { handleReactionClick } = usePostDetailActions({
    postId: post.id,
    user,
  });

  const scrollToOriginalPost = useCallback(() => {
    // Intentionally empty - will be implemented with proper ref forwarding later
  }, []);

  return (
    <PostViewLayout>
      <PostDetailHeader />
      <div className="flex-1 p-4">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {/* Original Post Display */}
          <PostFeed className="border-none pb-2">
            <PostItemOnDetailPage
              post={post}
              organization={organization}
              user={user}
              withLinks={false}
              onReactionClick={handleReactionClick}
              commentCount={0}
            />
          </PostFeed>

          {/* Comment Input */}
          <div className="border-y border-neutral-gray1">
            <Surface className="border-0 px-0 py-4">
              <PostUpdate
                parentPostId={post.id}
                placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
                label={t('Comment')}
                onSuccess={scrollToOriginalPost}
              />
            </Surface>
          </div>

          {/* Comments Section */}
          <div className="mt-2">
            <Suspense fallback={<CommentsSkeleton />}>
              <Comments
                postId={post.id}
                organization={organization}
                user={user}
                onReactionClick={handleReactionClick}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </PostViewLayout>
  );
}
