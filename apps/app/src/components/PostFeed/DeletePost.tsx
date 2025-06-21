'use client';

import { trpc } from '@op/api/client';
import { Menu, MenuItem } from '@op/ui/Menu';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';

export const DeletePost = ({
  postId,
  organizationId,
}: {
  postId: string;
  organizationId: string;
}) => {
  const utils = trpc.useUtils();
  const router = useRouter();

  const deletePost = trpc.organization.deletePost.useMutation({
    onSuccess: () => {
      void utils.organization.listPosts.invalidate();
      void utils.organization.listAllPosts.invalidate();
      router.refresh();
      toast.success({ message: 'Post deleted' });
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
  };

  return (
    <Menu
      onAction={() => {
        if (postId && organizationId) {
          handleDeletePost(postId, organizationId);
        }
      }}
      className="rounded-sm"
    >
      <MenuItem key="delete" className="text-functional-red">
        Delete
      </MenuItem>
    </Menu>
  );
};
