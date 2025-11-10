'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Surface } from '@op/ui/Surface';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import React from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { PostFeed, PostItemOnDetailPage } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { CommentSkeleton, Comments } from './Comments';
import { PostDetailHeader } from './PostDetailHeader';
import { PostViewLayout } from './PostViewLayout';
import { usePostDetailActions } from './usePostDetailActions';

export function PostDetail({ postId, slug }: { postId: string; slug: string }) {
  const t = useTranslations();
  const { user } = useUser();

  const [[post, organization]] = trpc.useSuspenseQueries((t) => [
    t.posts.getPost({ postId, includeChildren: false }),
    t.organization.getBySlug({ slug }),
  ]);

  if (!post) {
    notFound();
  }

  const { handleReactionClick } = usePostDetailActions({
    postId: post.id,
    user,
  });

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
                placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` ${t('as')} ${user?.currentProfile?.name}` : ''}...`}
                label={t('Comment')}
              />
            </Surface>
          </div>

          {/* Comments Section */}
          <div className="mt-2">
            <ErrorBoundary>
              <Suspense fallback={<CommentSkeleton />}>
                <Comments
                  postId={post.id}
                  organization={organization}
                  user={user}
                  onReactionClick={handleReactionClick}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </PostViewLayout>
  );
}
