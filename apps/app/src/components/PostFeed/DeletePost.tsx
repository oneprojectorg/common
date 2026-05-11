'use client';

import { trpc } from '@op/api/client';
import type { Post } from '@op/api/encoders';
import { Menu, MenuItem } from '@op/ui/Menu';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

export const DeletePost = ({ post }: { post: Post }) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const router = useRouter();

  const deletePost = trpc.organization.deletePost.useMutation({
    onSuccess: () => {
      void utils.organization.listPosts.invalidate();
      void utils.organization.listAllPosts.invalidate();
      router.refresh();
      toast.success({ message: t('Post deleted') });
    },
    onError: (error) => {
      toast.error({ message: error.message || t('Failed to delete post') });
    },
  });

  const handleDeletePost = (post: Post) => {
    deletePost.mutate({
      id: post.id,
    });
  };

  return (
    <Menu
      onAction={() => {
        if (post.id) {
          handleDeletePost(post);
        }
      }}
      className="min-w-28 p-2"
    >
      <MenuItem
        key="delete"
        className="!bg-transparent px-3 py-1 pr-3 pl-3 text-functional-red"
      >
        {t('Delete')}
      </MenuItem>
    </Menu>
  );
};
