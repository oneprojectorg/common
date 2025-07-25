'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { PostToOrganization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Surface } from '@op/ui/Surface';
import { useRef } from 'react';
import { LuX } from 'react-icons/lu';

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
  // const utils = trpc.useUtils();
  const { user } = useUser();
  const t = useTranslations();
  const { post, organization } = postToOrg;
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const { handleReactionClick, handleCommentClick } = usePostFeedActions({
    slug: organization?.profile?.slug,
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

  const handleCommentSuccess = () => {
    // No need to invalidate - onSuccess optimistic update handles this
    // utils.posts.getPosts.invalidate({
    //   parentPostId: post.id,
    // });

    // Scroll to the first comment immediately since optimistic update happens in onSuccess
    setTimeout(() => {
      if (commentsContainerRef.current) {
        const firstComment = commentsContainerRef.current.querySelector(
          '[data-is-first-comment="true"]',
        );
        if (firstComment) {
          firstComment.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 50); // Reduced timeout since update is immediate
  };

  const sourcePostProfile = post.profile;

  // Get the post author's name for the header
  const authorName = sourcePostProfile?.name || 'Unknown';

  // Transform comments data to match PostFeeds expected PostToOrganizaion format
  const comments =
    commentsData?.map((comment) => ({
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: null,
      postId: comment.id,
      organizationId: '', // Not needed for comments
      post: comment,
      organization: null, // Comments don't need organization context in the modal
    })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      isDismissable
      className="sm:max-h-auto h-svh max-h-none w-screen max-w-none overflow-y-auto rounded-none text-left sm:h-auto sm:w-[36rem] sm:max-w-[36rem]"
    >
      <ModalHeader className="flex items-center justify-between">
        {/* Desktop header */}
        <div className="hidden sm:flex sm:w-full sm:items-center sm:justify-between">
          {organization?.profile.name}'s Post
          <LuX className="size-6 cursor-pointer stroke-1" onClick={onClose} />
        </div>

        {/* Mobile header */}
        <div className="flex w-full items-center justify-between sm:hidden">
          <Button
            unstyled
            className="font-sans text-base text-primary-teal"
            onPress={onClose}
          >
            Close
          </Button>
          <h2 className="text-title-sm">{authorName}'s Post</h2>
          <div className="w-12" /> {/* Spacer for center alignment */}
        </div>
      </ModalHeader>

      <div className="flex flex-col gap-4">
        <div
          className="flex-1 overflow-y-auto px-4 pt-6"
          ref={commentsContainerRef}
        >
          {/* Original Post Display */}
          <PostFeed className="border-none">
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
            <div className="py-8 text-center text-gray-500">
              Loading discussion...
            </div>
          ) : comments.length > 0 ? (
            <div>
              <PostFeed className="border-none">
                {comments.map((comment, i) => (
                  <>
                    <div 
                      data-comment-item 
                      data-comment-id={comment.post.id}
                      data-is-first-comment={i === 0}
                    >
                      <PostItem
                        key={i}
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
                  </>
                ))}
              </PostFeed>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
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
              onSuccess={handleCommentSuccess}
              label={t('Comment')}
            />
          </Surface>
        </ModalFooter>
      </div>
    </Modal>
  );
}
