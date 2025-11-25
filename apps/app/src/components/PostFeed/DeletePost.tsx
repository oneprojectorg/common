'use client';

import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import type { Post } from '@op/api/encoders';
import { Menu, MenuItem } from '@op/ui/Menu';
import { toast } from '@op/ui/Toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

export const DeletePost = ({
  post,
  profileId,
}: {
  post: Post;
  profileId: string;
}) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const deletePost = useMutation({
    mutationFn: (input: Parameters<typeof trpc.organization.deletePost.mutate>[0]) => trpc.organization.deletePost.mutate(input),
    onMutate: async () => {
      // If this is a comment (has parentPostId), update the comments cache optimistically
      if (post.parentPostId) {
        const queryKey = createCommentsQueryKey(post.parentPostId);

        // Cancel any outgoing refetches for comments
        await queryClient.cancelQueries({ queryKey: [['posts', 'getPosts'], queryKey] });

        // Snapshot previous comments
        const previousComments = queryClient.getQueryData<Post[]>([['posts', 'getPosts'], queryKey]);

        // Optimistically remove the comment
        queryClient.setQueryData<Post[]>([['posts', 'getPosts'], queryKey], (old) => {
          if (!old) return old;
          return old.filter((comment) => comment.id !== post.id);
        });

        return { previousComments };
      }

      return {};
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [['organization', 'listPosts']] });
      void queryClient.invalidateQueries({ queryKey: [['organization', 'listAllPosts']] });
      router.refresh();
      toast.success({ message: 'Post deleted' });
    },
    onError: (error, _variables, context) => {
      // Rollback optimistic update for comments on error
      if (post.parentPostId && context?.previousComments) {
        const queryKey = createCommentsQueryKey(post.parentPostId);
        queryClient.setQueryData([['posts', 'getPosts'], queryKey], context.previousComments);
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
        className="!bg-transparent px-3 py-1 pl-3 pr-3 text-functional-red"
      >
        Delete
      </MenuItem>
    </Menu>
  );
};
