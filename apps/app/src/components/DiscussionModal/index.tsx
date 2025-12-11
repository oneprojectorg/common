'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { Organization, Post } from '@op/api/encoders';
import { Modal, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Surface } from '@op/ui/Surface';
import { useCallback, useRef } from 'react';
import React from 'react';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';
import { CommentSkeleton } from '../posts/Comments';

export function DiscussionModal({
  post,
  organization,
  isOpen,
  onClose,
}: {
  post: Post;
  organization: Organization | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const t = useTranslations();
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const { handleReactionClick, handleCommentClick } = usePostFeedActions();

  // Get comments for the post using getPosts without profileId (works for all post types)
  const { data: commentsData, isLoading } = trpc.posts.getPosts.useQuery(
    {
      parentPostId: post.id,
      limit: 50,
      offset: 0,
      includeChildren: false,
    },
    { enabled: isOpen },
  );

  const comments = commentsData || [];

  // Function to scroll to show the bottom of the original post after adding a comment
  const scrollToOriginalPost = useCallback(() => {
    if (commentsContainerRef.current) {
      // Small delay to ensure DOM has updated with new comment
      setTimeout(() => {
        const container = commentsContainerRef.current;
        if (container) {
          const originalPostContainer =
            container.querySelector('.originalPost');
          if (originalPostContainer) {
            // Scroll to show the bottom of the original post with some padding
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

  const sourcePostProfile = post.profile;

  // Get the post author's name for the header
  const authorName =
    sourcePostProfile?.name ?? organization?.profile.name ?? '';


  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      isDismissable
      className="h-svh text-left"
    >
      <ModalHeader>{authorName}'s Post</ModalHeader>

      <div className="flex flex-col gap-4">
        <div
          className="flex-1 overflow-y-auto px-4 pt-6"
          ref={commentsContainerRef}
        >
          {/* Original Post Display */}
          <PostFeed className="originalPost border-none">
            <PostItem
              post={post}
              organization={organization ?? null}
              user={user}
              withLinks={false}
              onReactionClick={handleReactionClick}
            />
            <hr className="bg-neutral-gray1" />
          </PostFeed>
          {/* Comments Display */}
          {isLoading ? (
            <PostFeed className="border-none">
              <CommentSkeleton />
            </PostFeed>
          ) : comments.length > 0 ? (
            <div role="feed" aria-label={`${comments.length} comments`}>
              <PostFeed className="border-none">
                {comments.map((comment, i) => (
                  <React.Fragment key={comment.id}>
                    <div
                      data-comment-item
                      data-comment-id={comment.id}
                      data-is-first-comment={i === 0}
                    >
                      <PostItem
                        post={comment}
                        organization={organization ?? null}
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
              No comments yet. Be the first to comment!
            </div>
          )}
        </div>

        {/* Comment Input using PostUpdate */}
        <ModalFooter className="sticky">
          <Surface className="w-full border-0 p-0 pt-5 sm:border sm:p-4">
            <PostUpdate
              parentPostId={post.id}
              placeholder={`Comment${user.currentProfile?.name ? ` as ${user.currentProfile?.name}` : ''}...`}
              label={t('Comment')}
              onSuccess={scrollToOriginalPost}
            />
          </Surface>
        </ModalFooter>
      </div>
    </Modal>
  );
}
