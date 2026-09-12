'use client';

import { useUser } from '@/utils/UserProvider';
import { useTRPC } from '@op/api/client';
import { useSuspenseQueries } from '@tanstack/react-query';
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
  const trpc = useTRPC();
  const { user } = useUser();

  const [{ data: post }, { data: organization }] = useSuspenseQueries({
    queries: [
      trpc.posts.getPost.queryOptions({ postId, includeChildren: false }),
      trpc.organization.getBySlug.queryOptions({ slug }),
    ],
  });

  if (!post) {
    notFound();
  }

  const { handleLikeClick } = usePostDetailActions({
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
              onLikeClick={handleLikeClick}
              commentCount={0}
            />
          </PostFeed>

          {/* Comment Input */}
          <div className="border-y py-4">
            <PostUpdate
              parentPostId={post.id}
              placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` ${t('as')} ${user?.currentProfile?.name}` : ''}...`}
              label={t('Comment')}
            />
          </div>

          {/* Comments Section */}
          <div className="mt-2">
            <ErrorBoundary>
              <Suspense fallback={<CommentSkeleton />}>
                <Comments
                  postId={post.id}
                  organization={organization}
                  user={user}
                  onLikeClick={handleLikeClick}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </PostViewLayout>
  );
}
