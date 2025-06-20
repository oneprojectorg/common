'use client';

import { trpc } from '@op/api/client';
import { Menu, MenuItem } from '@op/ui/Menu';
import { toast } from '@op/ui/Toast';

export const DeletePost = ({
  postId,
  organizationId,
}: {
  postId: string;
  organizationId: string;
}) => {
  const utils = trpc.useUtils();

  const deletePost = trpc.organization.deletePost.useMutation({
    onSuccess: () => {
      toast.success({ message: 'Post deleted' });
      void utils.organization.listPosts.invalidate();
    },
    onError: (error) => {
      toast.error({ message: error.message || 'Failed to delete post' });
    },
  });

  const handleDeletePost = (postId: string, organizationId: string) => {
    deletePost.mutate({
      id: postId,
      organizationId,
    });
    utils.organization.listPosts.invalidate();
  };
  return (
    <Menu
      onAction={() => {
        if (postId && organizationId) {
          handleDeletePost(postId, organizationId);
        }
      }}
    >
      <MenuItem key="delete">Delete</MenuItem>
    </Menu>
  );
};
