'use client';

import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import type { Post } from '@op/api/encoders';
import { Menu, MenuItem } from '@op/ui/Menu';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';

export const DeletePost = ({
  post,
  profileId,
}: {
  post: Post;
  profileId: string;
}) => {
  const utils = trpc.useUtils();
  const router = useRouter();

  const deletePost = trpc.organization.deletePost.useMutation({
    onMutate: async () => {
      // If this is a comment (has parentPostId), update the comments cache optimistically
      if (post.parentPostId) {
        const queryKey = createCommentsQueryKey(post.parentPostId);

        // Cancel any outgoing refetches for comments
        await utils.posts.getPosts.cancel(queryKey);

        // Snapshot previous comments
        const previousComments = utils.posts.getPosts.getData(queryKey);

        // Optimistically remove the comment
        utils.posts.getPosts.setData(queryKey, (old) => {
          if (!old) return old;
          return old.filter((comment) => comment.id !== post.id);
        });

        return { previousComments };
      }

      return {};
    },
    onSuccess: () => {
      void utils.organization.listPosts.invalidate();
      void utils.organization.listAllPosts.invalidate();
      router.refresh();
      toast.success({ message: 'Post deleted' });
    },
    onError: (error, _variables, context) => {
      // Rollback optimistic update for comments on error
      if (post.parentPostId && context?.previousComments) {
        const queryKey = createCommentsQueryKey(post.parentPostId);
        utils.posts.getPosts.setData(queryKey, context.previousComments);
      }

      toast.error({ message: error.message || 'Failed to delete post' });
    },
  });

  const handleDeletePost = (post: Post, profileId: string) => {
    deletePost.mutate({
      id: post.id,
      profileId: profileId,
    });
  };

  return (
    <Menu
      onAction={() => {
        if (post.id && profileId) {
          handleDeletePost(post, profileId);
        }
      }}
      className="min-w-28 p-2"
    >
      <MenuItem
        key="delete"
        className="px-3 py-1 pl-3 pr-3 !bg-transparent text-functional-red"
      >
        Delete
      </MenuItem>
    </Menu>
  );
};
