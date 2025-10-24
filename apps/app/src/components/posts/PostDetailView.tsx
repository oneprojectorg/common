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
      <div className="flex flex-col gap-4">
        <div
          className="flex-1 overflow-y-auto px-4 pt-6"
          ref={commentsContainerRef}
        >
          {/* Original Post Display */}
          <PostFeed className="originalPost border-none">
            <PostItem
              postToOrg={postToOrg}
              user={user}
              withLinks={false}
              onReactionClick={handleReactionClick}
            />
            <hr className="bg-neutral-gray1" />
          </PostFeed>

          {/* Comments Display */}
          {isLoading ? (
            <div
              className="py-8 text-center text-gray-500"
              role="status"
              aria-label="Loading discussion"
            >
              {t('Loading discussion...')}
            </div>
          ) : comments.length > 0 ? (
            <div role="feed" aria-label={`${comments.length} comments`}>
              <PostFeed className="border-none">
                {comments.map((comment, i) => (
                  <React.Fragment key={comment.post.id}>
                    <div
                      data-comment-item
                      data-comment-id={comment.post.id}
                      data-is-first-comment={i === 0}
                    >
                      <PostItem
                        postToOrg={comment}
                        user={user}
                        withLinks={false}
                        onReactionClick={handleReactionClick}
                        onCommentClick={handleCommentClick}
                        className="sm:px-0"
                      />
                    </div>
                    {comments.length !== i + 1 && (
                      <hr className="bg-neutral-gray1" />
                    )}
                  </React.Fragment>
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
        </div>

        {/* Comment Input using PostUpdate */}
        <div className="sticky bottom-0 border-t border-neutral-gray1 bg-white">
          <Surface className="w-full border-0 p-4 sm:border sm:p-4">
            <PostUpdate
              parentPostId={currentPost.id}
              placeholder={`${t('Comment')}${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
              label={t('Comment')}
              onSuccess={scrollToOriginalPost}
            />
          </Surface>
        </div>
      </div>
    </PostViewLayout>
  );
}
