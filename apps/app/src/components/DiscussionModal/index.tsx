'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { PostToOrganization } from '@op/api/encoders';
import { Modal, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Surface } from '@op/ui/Surface';
import { useCallback, useMemo, useRef } from 'react';
import React from 'react';

import { useTranslations } from '@/lib/i18n';

import { PostFeed, PostItem, usePostFeedActions } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';

export function DiscussionModal({
  postToOrg,
  isOpen,
  onClose,
}: {
  postToOrg: PostToOrganization;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const t = useTranslations();
  const { post, organization } = postToOrg;
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const { handleReactionClick, handleCommentClick } = usePostFeedActions({
    slug: organization?.profile?.slug,
    parentPostId: post.id,
  });

  const { data: commentsData, isLoading } = trpc.posts.getPosts.useQuery(
    {
      parentPostId: post.id, // Get threads (child posts) of this post
      limit: 50,
      offset: 0,
      includeChildren: false,
    },
    { enabled: isOpen },
  );

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

  // Transform comments data to match PostFeeds expected PostToOrganizaion format
  const comments = useMemo(
    () =>
      commentsData?.map((comment) => ({
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        deletedAt: null,
        postId: comment.id,
        organizationId: '', // Not needed for comments
        post: comment,
        organization: null, // Comments don't need organization context in the modal
      })) || [],
    [commentsData],
  );

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
              Loading discussion...
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
              No comments yet. Be the first to comment!
            </div>
          )}
        </div>

        {/* Comment Input using PostUpdate */}
        <ModalFooter className="hidden px-4 sm:flex">
          <Surface className="w-full border-0 p-0 pt-5 sm:border sm:p-4">
            <PostUpdate
              parentPostId={post.id}
              placeholder={`Comment${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
              label={t('Comment')}
              onSuccess={scrollToOriginalPost}
            />
          </Surface>
        </ModalFooter>
      </div>
    </Modal>
  );
}
