'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization, Post } from '@op/api/encoders';
import { Surface } from '@op/ui/Surface';
import { useCallback, useRef } from 'react';
import React from 'react';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, PostItemOnDetailPage } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { PostDetailHeader } from './PostDetailHeader';
import { PostViewLayout } from './PostViewLayout';
import { usePostDetailActions } from './usePostDetailActions';

export function PostDetailView({
  post,
  organization,
}: {
  post: Post;
  organization: Organization | null;
}) {
  const t = useTranslations();
  const { user } = useUser();
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // Create PostToOrganization format for the main post
  const postToOrg = {
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    deletedAt: null,
    postId: post.id,
    organizationId: organization?.id || '',
    post: post,
    organization: organization || null,
  };

  const { handleReactionClick } = usePostDetailActions({
    postId: post.id,
    user,
  });

  // Get comments for the post
  const { data: commentsData, isLoading } = trpc.posts.getPosts.useQuery({
    parentPostId: post.id,
    limit: 50,
    offset: 0,
    includeChildren: false,
  });

  // Function to scroll to show the bottom of the original post after adding a comment
  const scrollToOriginalPost = useCallback(() => {
    if (commentsContainerRef.current) {
      setTimeout(() => {
        const container = commentsContainerRef.current;
        if (container) {
          const originalPostContainer =
            container.querySelector('.originalPost');
          if (originalPostContainer) {
            originalPostContainer.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest',
            });
          }
        }
      }, 100);
    }
  }, []);

  // Transform comments data to match PostToOrganization format
  const comments = !commentsData
    ? []
    : commentsData.map((comment) => ({
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        deletedAt: null,
        postId: comment.id,
        organizationId: organization?.id || '',
        post: comment,
        organization: organization || null,
      }));

  return (
    <PostViewLayout>
      <PostDetailHeader />
      <div className="flex-1 p-4">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {/* Original Post Display */}
          <PostFeed className="originalPost border-none pb-2">
            <PostItemOnDetailPage
              postToOrg={postToOrg}
              user={user}
              withLinks={false}
              onReactionClick={handleReactionClick}
              commentCount={comments.length}
            />
          </PostFeed>

          {/* Comment Input */}
          <div className="border-y border-neutral-gray1">
            <Surface className="border-0 p-0 sm:py-4">
              <PostUpdate
                parentPostId={post.id}
                placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
                label={t('Comment')}
                onSuccess={scrollToOriginalPost}
              />
            </Surface>
          </div>

          {/* Comments Section */}
          <div className="mt-2" ref={commentsContainerRef}>
            {/* Comments Display */}
            {isLoading ? (
              <div
                className="py-8 text-center text-neutral-gray4"
                role="status"
                aria-label="Loading comments"
              >
                {t('Loading comments...')}
              </div>
            ) : comments.length > 0 ? (
              <div role="feed" aria-label={`${comments.length} comments`}>
                <PostFeed>
                  {comments.map((comment) => (
                    <div key={comment.post.id}>
                      <PostItem
                        postToOrg={comment}
                        user={user}
                        withLinks={false}
                        onReactionClick={handleReactionClick}
                        className="sm:px-0"
                      />
                      <hr className="mt-4 bg-neutral-gray1" />
                    </div>
                  ))}
                </PostFeed>
              </div>
            ) : (
              <div
                className="py-8 text-center text-neutral-gray4"
                role="status"
                aria-label="No comments"
              >
                {t('No comments yet. Be the first to comment!')}
              </div>
            )}
          </div>
        </div>
      </div>
    </PostViewLayout>
  );
}
