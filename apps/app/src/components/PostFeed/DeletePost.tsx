'use client';

import { trpc } from '@op/api/client';
import { Menu, MenuItem } from '@op/ui/Menu';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';

export const DeletePost = ({
  postId,
  profileId,
}: {
  postId: string;
  profileId: string;
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

  const handleDeletePost = (postId: string, profileId: string) => {
    deletePost.mutate({
      id: postId,
      profileId: profileId,
    });
  };

  return (
    <Menu
      onAction={() => {
        if (postId && profileId) {
          handleDeletePost(postId, profileId);
        }
      }}
      className="min-w-28 p-2"
    >
      <MenuItem
        key="delete"
        className="!bg-transparent px-3 py-1 pl-3 pr-3 text-functional-red"
      >
        Delete
      </MenuItem>
    </Menu>
  );
};
