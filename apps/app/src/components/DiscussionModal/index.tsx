'use client';

import { trpc } from '@op/api/client';
import type { Post } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalHeader } from '@op/ui/Modal';
import { useEffect } from 'react';
import { LuX } from 'react-icons/lu';

import { PostFeed } from '../PostFeed';
import { PostUpdate } from '../PostUpdate';

interface DiscussionModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
}

export function DiscussionModal({ post, isOpen, onClose }: DiscussionModalProps) {
  const utils = trpc.useUtils();

  const { data: commentsData, isLoading } = trpc.posts.getPosts.useQuery(
    {
      parentPostId: post.id ?? null, // Get comments (child posts) of this post
      limit: 50,
      offset: 0,
      includeChildren: false,
    },
    { enabled: isOpen },
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCommentSuccess = () => {
    utils.posts.getPosts.invalidate({
      parentPostId: post.id ?? null, // Invalidate comments for this post
    });
  };

  // Transform comments data to match PostFeed expected format
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
      className="h-svh max-h-none w-screen max-w-none overflow-y-auto rounded-none text-left sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem] sm:rounded-md"
    >
      <ModalHeader className="flex items-center justify-between">
        {/* Desktop header */}
        <div className="hidden sm:flex sm:w-full sm:items-center sm:justify-between">
          Discussion
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
          <h2 className="text-title-sm">Discussion</h2>
          <div className="w-12" /> {/* Spacer for center alignment */}
        </div>
      </ModalHeader>

      <div className="flex flex-col gap-4 p-6">
        {/* Original Post Display */}
        <div className="border-b pb-4">
          <PostFeed
            posts={[
              {
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
                deletedAt: null,
                postId: post.id,
                organizationId: '',
                post,
                organization: null,
              },
            ]}
            withLinks={false}
            className="border-none p-0"
          />
        </div>

        {/* Comments Display */}
        <div className="max-h-96 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">
              Loading discussion...
            </div>
          ) : comments.length > 0 ? (
            <PostFeed
              posts={comments}
              withLinks={false}
              className="border-none"
            />
          ) : (
            <div className="py-8 text-center text-gray-500">
              No comments yet. Be the first to comment!
            </div>
          )}
        </div>

        {/* Comment Input using PostUpdate */}
        <div className="border-t pt-4">
          <PostUpdate
            parentPostId={post.id}
            placeholder="Write a comment..."
            onSuccess={handleCommentSuccess}
            className="border-none shadow-none"
          />
        </div>
      </div>
    </Modal>
  );
}