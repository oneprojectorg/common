'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Post } from '@op/api/encoders';
import { Surface } from '@op/ui/Surface';
import { useCallback, useMemo, useRef } from 'react';
import React from 'react';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { PostDetailHeader } from './PostDetailHeader';
import { PostViewLayout } from './PostViewLayout';

export function PostDetailView({ post: initialPost }: { post: Post }) {
  const t = useTranslations();
  const { user } = useUser();
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch fresh post data
  const { data: fetchedPost } = trpc.posts.getPost.useQuery(
    {
      postId: initialPost.id,
      includeChildren: false,
    },
    {
      initialData: initialPost,
    },
  );

  // Use fetched post or fall back to initial post
  const currentPost = fetchedPost || initialPost;

  // Create PostToOrganization format for the main post
  const postToOrg = useMemo(
    () => ({
      createdAt: currentPost.createdAt,
      updatedAt: currentPost.updatedAt,
      deletedAt: null,
      postId: currentPost.id,
      organizationId: '',
      post: currentPost,
      organization: null,
    }),
    [currentPost],
  );

  const { handleReactionClick, handleCommentClick } = usePostFeedActions({
    parentPostId: currentPost.id,
    user,
  });

  // Get comments for the post
  const { data: commentsData, isLoading } = trpc.posts.getPosts.useQuery({
    parentPostId: currentPost.id,
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
  const comments = useMemo(() => {
    if (!commentsData) return [];

    return commentsData.map((comment) => ({
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: null,
      postId: comment.id,
      organizationId: '',
      post: comment,
      organization: null,
    }));
  }, [commentsData]);

  return (
    <PostViewLayout>
      <PostDetailHeader />
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          {/* Original Post Display */}
          <PostFeed className="originalPost border-none">
            <PostItem
              postToOrg={postToOrg}
              user={user}
              withLinks={false}
              onReactionClick={handleReactionClick}
            />
          </PostFeed>

          {/* Comments Section */}
          <div className="mt-12" ref={commentsContainerRef}>
            <div className="border-t border-neutral-gray1 pt-8">
              <h3 className="mb-6 text-lg font-semibold text-neutral-charcoal">
                {t('Comments')} ({comments.length})
              </h3>

              {/* Comments Display */}
              {isLoading ? (
                <div
                  className="py-8 text-center text-gray-500"
                  role="status"
                  aria-label="Loading comments"
                >
                  {t('Loading comments...')}
                </div>
              ) : comments.length > 0 ? (
                <div role="feed" aria-label={`${comments.length} comments`}>
                  <PostFeed>
                    {comments.map((comment, i) => (
                      <div key={comment.post.id}>
                        <PostItem
                          postToOrg={comment}
                          user={user}
                          withLinks={false}
                          onReactionClick={handleReactionClick}
                          onCommentClick={handleCommentClick}
                          className="sm:px-0"
                        />
                        {comments.length !== i + 1 && (
                          <hr className="my-4 bg-neutral-gray1" />
                        )}
                      </div>
                    ))}
                  </PostFeed>
                </div>
              ) : (
                <div
                  className="py-8 text-center text-gray-500"
                  role="status"
                  aria-label="No comments"
                >
                  {t('No comments yet. Be the first to comment!')}
                </div>
              )}

              {/* Comment Input */}
              <div className="mt-8">
                <Surface className="border-0 p-0 sm:border sm:p-4">
                  <PostUpdate
                    parentPostId={currentPost.id}
                    placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
                    label={t('Comment')}
                    onSuccess={scrollToOriginalPost}
                  />
                </Surface>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PostViewLayout>
  );
}
