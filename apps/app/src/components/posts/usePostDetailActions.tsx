'use client';

import type { PostFeedUser } from '@/utils/optimisticUpdates';
import { togglePostLike } from '@/utils/optimisticUpdates';
import { createCommentsQueryKey } from '@/utils/queryKeys';
import { trpc } from '@op/api/client';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

/**
 * Hook for handling likes on the post detail page.
 * Manages optimistic updates for both the main post and its comments.
 * Isolates the complexity of the optimistic updates to a single hook.
 */
export const usePostDetailActions = ({
  postId,
  user,
}: {
  postId: string;
  user?: PostFeedUser;
}) => {
  const utils = trpc.useUtils();
  const t = useTranslations();

  const toggleLike = trpc.organization.toggleLike.useMutation({
    onMutate: async ({ postId: likedPostId }) => {
      // Query keys for the detail page
      const mainPostQueryKey = {
        postId,
        includeChildren: false,
      };
      const commentsQueryKey = createCommentsQueryKey(postId, undefined);

      // Cancel outgoing refetches
      await utils.posts.getPost.cancel(mainPostQueryKey);
      await utils.posts.getPosts.cancel(commentsQueryKey);

      // Snapshot previous values
      const previousMainPost = utils.posts.getPost.getData(mainPostQueryKey);
      const previousComments = utils.posts.getPosts.getData(commentsQueryKey);

      // Optimistically update main post
      utils.posts.getPost.setData(mainPostQueryKey, (old) => {
        if (!old) {
          return old;
        }

        return togglePostLike({
          item: { post: old },
          postId: likedPostId,
          user,
        }).post;
      });

      // Optimistically update comments
      utils.posts.getPosts.setData(commentsQueryKey, (old) => {
        if (!old) {
          return old;
        }

        return old.map(
          (comment) =>
            togglePostLike({
              item: { post: comment },
              postId: likedPostId,
              user,
            }).post,
        );
      });

      return { previousMainPost, previousComments };
    },
    onError: (err, _variables, context) => {
      const mainPostQueryKey = {
        postId,
        includeChildren: false,
      };
      const commentsQueryKey = createCommentsQueryKey(postId);

      // Rollback on error
      if (context?.previousMainPost) {
        utils.posts.getPost.setData(mainPostQueryKey, context.previousMainPost);
      }
      if (context?.previousComments) {
        utils.posts.getPosts.setData(
          commentsQueryKey,
          context.previousComments,
        );
      }

      toast.error(err.message || t('Failed to update like'));
    },
    // The detail page never refetches on its own (`refetchOnWindowFocus` is
    // off), so without this a batched double-click — where both requests race
    // to "added" and the two optimistic flips cancel out — leaves the button
    // disagreeing with the server until a full reload.
    onSettled: () => {
      void utils.posts.getPost.invalidate();
      void utils.posts.getPosts.invalidate();
    },
  });

  const handleLikeClick = (likedPostId: string) =>
    toggleLike.mutateAsync({ postId: likedPostId });

  return { handleLikeClick };
};
