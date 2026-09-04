'use client';

import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import type { Post } from '@op/api/encoders';
import { DropdownMenuItem } from '@op/sense/DropdownMenu';
import { toast } from '@op/sense/Toast';
import { useRouter } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

export const DeletePostMenuItem = ({ post }: { post: Post }) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const router = useRouter();

  const deletePost = trpc.organization.deletePost.useMutation({
    onMutate: async () => {
      if (post.parentPostId) {
        const queryKey = createCommentsQueryKey(post.parentPostId);

        await utils.posts.getPosts.cancel(queryKey);

        const previousComments = utils.posts.getPosts.getData(queryKey);

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
      toast.success(t('Post deleted'));
    },
    onError: (error, _variables, context) => {
      if (post.parentPostId && context?.previousComments) {
        const queryKey = createCommentsQueryKey(post.parentPostId);
        utils.posts.getPosts.setData(queryKey, context.previousComments);
      }

      toast.error(error.message || t('Failed to delete post'));
    },
  });

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
