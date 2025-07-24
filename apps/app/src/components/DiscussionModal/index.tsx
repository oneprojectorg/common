'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { PostToOrganization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Surface } from '@op/ui/Surface';
import { LuX } from 'react-icons/lu';

import { PostFeed } from '../PostFeed';
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
  const utils = trpc.useUtils();
  const { user } = useUser();
  const { post, organizationId, organization } = postToOrg;

  const { data: commentsData, isLoading } = trpc.posts.getPosts.useQuery(
    {
      parentPostId: post.id, // Get comments (child posts) of this post
      limit: 50,
      offset: 0,
      includeChildren: false,
    },
    { enabled: isOpen },
  );

  const handleCommentSuccess = () => {
    utils.posts.getPosts.invalidate({
      parentPostId: post.id, // Invalidate comments for this post
    });
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
      className="h-svh max-h-none w-screen max-w-none overflow-y-auto rounded-none text-left sm:h-auto sm:max-h-[75vh] sm:w-[36rem] sm:max-w-[36rem] sm:rounded-md"
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
        <div className="max-h-96 flex-1 overflow-y-auto pt-6">
          {/* Original Post Display */}
          <PostFeed
            posts={[postToOrg]}
            user={user}
            withLinks={false}
            className="border-none"
            slug={organization?.profile?.slug}
          />
          {/* Comments Display */}
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">
              Loading discussion...
            </div>
          ) : comments.length > 0 ? (
            <PostFeed
              posts={comments}
              user={user}
              withLinks={false}
              className="border-none"
              slug={organization?.profile?.slug}
            />
          ) : (
            <div className="py-8 text-center text-gray-500">
              No comments yet. Be the first to comment!
            </div>
          )}
        </div>

        {/* Comment Input using PostUpdate */}
        <ModalFooter className="hidden sm:flex">
          <Surface className="w-full border-0 p-0 pt-5 sm:border sm:p-4">
            <PostUpdate
              parentPostId={post.id}
              placeholder={`Comment${user?.currentProfile?.name ? ` as ${user?.currentProfile?.name}` : ''}...`}
              onSuccess={handleCommentSuccess}
            />
          </Surface>
        </ModalFooter>
      </div>
    </Modal>
  );
}
