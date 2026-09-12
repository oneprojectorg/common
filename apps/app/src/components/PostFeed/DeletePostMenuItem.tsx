'use client';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { useTRPC } from '@op/api/client';
import type { Post } from '@op/api/encoders';
import { DropdownMenuItem } from '@op/sense/DropdownMenu';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

export const DeletePostMenuItem = ({ post }: { post: Post }) => {
  const trpc = useTRPC();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const router = useRouter();

  const deletePost = useMutation(
    trpc.organization.deletePost.mutationOptions({
      onMutate: async () => {
        if (post.parentPostId) {
          const queryKey = createCommentsQueryKey(post.parentPostId);

          await queryClient.cancelQueries(
            trpc.posts.getPosts.queryFilter(queryKey),
          );

          const previousComments = queryClient.getQueryData(
            trpc.posts.getPosts.queryKey(queryKey),
          );

          queryClient.setQueryData(
            trpc.posts.getPosts.queryKey(queryKey),
            (old) => {
              if (!old) return old;
              return {
                items: old.items.filter((comment) => comment.id !== post.id),
              };
            },
          );

          return { previousComments };
        }

        return {};
      },
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.organization.listPosts.pathFilter(),
        );
        void queryClient.invalidateQueries(
          trpc.organization.listAllPosts.pathFilter(),
        );
        router.refresh();
        toast.success(t('Post deleted'));
      },
      onError: (error, _variables, context) => {
        if (post.parentPostId && context?.previousComments) {
          const queryKey = createCommentsQueryKey(post.parentPostId);
          queryClient.setQueryData(
            trpc.posts.getPosts.queryKey(queryKey),
            context.previousComments,
          );
        }

        toast.error(error.message || t('Failed to delete post'));
      },
    }),
  );

  return (
    <DropdownMenuItem
      variant="destructive"
      onClick={() => {
        if (post.id) {
          deletePost.mutate({ id: post.id });
        }
      }}
    >
      {t('Delete')}
    </DropdownMenuItem>
  );
};
